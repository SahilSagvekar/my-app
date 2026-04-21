'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { getVideoSource } from '../workflow/VideoUrlHelper';
import { ReviewComment, ReviewStatus } from '../review/types';
import { useAuth } from '../auth/AuthContext';
import type { ReviewConnectionInsight } from './ReviewConnectionIndicator';
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
    proxyUrl?: string | null;
    sizeBytes?: number;
}

interface ReviewAsset {
    id: string;
    title: string;
    subtitle?: string;
    videoUrl: string;
    // Optional lighter-weight encode specifically for review playback (e.g. 1080p/720p)
    reviewVideoUrl?: string;
    thumbnail: string;
    runtime: string;
    status: 'draft' | 'in_qc' | 'client_review' | 'approved';
    client: string;
    platform: string;
    resolution: string;
    fileSize: string;
    fileSizeBytes?: number;
    uploader: string;
    uploadDate: string;
    versions: Version[];
    currentVersion: string;
    downloadEnabled: boolean;
    approvalLocked: boolean;
    proxyUrl?: string | null;
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

type NetworkInformationLike = {
    downlink?: number;
    type?: string;
    effectiveType?: string;
    saveData?: boolean;
    addEventListener?: (type: 'change', listener: () => void) => void;
    removeEventListener?: (type: 'change', listener: () => void) => void;
};

const BUFFER_EVENT_COOLDOWN_MS = 2500;

function parseFormattedFileSize(value?: string): number | null {
    if (!value) return null;

    const match = value.trim().match(/^([\d.]+)\s*(Bytes|KB|MB|GB|TB)$/i);
    if (!match) return null;

    const size = Number.parseFloat(match[1]);
    if (!Number.isFinite(size)) return null;

    const unit = match[2].toUpperCase();
    const powers: Record<string, number> = {
        BYTES: 0,
        KB: 1,
        MB: 2,
        GB: 3,
        TB: 4,
    };
    const power = powers[unit];

    if (power === undefined) return null;

    return Math.round(size * Math.pow(1024, power));
}

function calculateRequiredMbps(fileSizeBytes: number | null, durationSeconds: number): number | null {
    if (!fileSizeBytes || durationSeconds <= 0) return null;

    const averageBitrateMbps = (fileSizeBytes * 8) / durationSeconds / 1_000_000;
    if (!Number.isFinite(averageBitrateMbps) || averageBitrateMbps <= 0) return null;

    return Math.max(averageBitrateMbps * 1.5, 1);
}

function formatMbps(value: number): string {
    return `${value >= 10 ? Math.round(value) : value.toFixed(1)} Mbps`;
}

function formatEffectiveType(value?: string): string | null {
    if (!value) return null;
    return value.toUpperCase().replace('SLOW-', 'SLOW ');
}

function getConnectionLabel(type?: string, effectiveType?: string): string {
    const normalizedType = type?.toLowerCase();
    const formattedEffectiveType = formatEffectiveType(effectiveType);

    switch (normalizedType) {
        case 'cellular':
            return formattedEffectiveType ? `Mobile data (${formattedEffectiveType})` : 'Mobile data';
        case 'wifi':
            return 'Wi-Fi';
        case 'ethernet':
            return 'Ethernet';
        case 'bluetooth':
            return 'Bluetooth';
        case 'wimax':
            return 'WiMAX';
        case 'none':
            return 'Offline';
        default:
            return 'Internet';
    }
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
    const [connectionSpeedMbps, setConnectionSpeedMbps] = useState<number | null>(null);
    const [connectionSpeedSupported, setConnectionSpeedSupported] = useState(false);
    const [connectionType, setConnectionType] = useState<string | null>(null);
    const [effectiveConnectionType, setEffectiveConnectionType] = useState<string | null>(null);
    const [bufferingEvents, setBufferingEvents] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [retryKey, setRetryKey] = useState(0); // cache-busting key for video retries
    const videoRetryCountRef = useRef(0);
    const MAX_VIDEO_RETRIES = 3;

    /* ── Review state ── */
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [confirmFinal, setConfirmFinal] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
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
    const lastBufferEventRef = useRef(0);

    /* ── Video source ── */
    const videoSource = useMemo(() => {
        const fileId = currentVersion || asset?.currentVersion;
        const v = asset?.versions.find(ver => ver.id === fileId);

        if (!asset) {
            return { type: 'video' as const, src: '' };
        }

        const source = getVideoSource({
            url: currentVideoUrl || asset.videoUrl || '',
            id: fileId,
            proxyUrl: v?.proxyUrl || asset.proxyUrl
        });

        // Append cache-busting param on retries to avoid stale/failed responses
        if (retryKey > 0 && source.type === 'video') {
            const separator = source.src.includes('?') ? '&' : '?';
            return { ...source, src: `${source.src}${separator}_r=${retryKey}` };
        }
        return source;
    }, [currentVideoUrl, asset, currentVersion, retryKey]);

    const currentVersionFileSizeBytes = useMemo(() => {
        const currentVersionAsset = asset?.versions.find(ver => ver.id === currentVersion);

        return currentVersionAsset?.sizeBytes
            ?? asset?.fileSizeBytes
            ?? parseFormattedFileSize(asset?.fileSize);
    }, [asset, currentVersion]);

    const requiredSpeedMbps = useMemo(() => {
        if (videoSource.type !== 'video') return null;
        return calculateRequiredMbps(currentVersionFileSizeBytes, duration);
    }, [videoSource.type, currentVersionFileSizeBytes, duration]);

    const connectionInsight = useMemo<ReviewConnectionInsight>(() => {
        const connectionLabel = getConnectionLabel(connectionType ?? undefined, effectiveConnectionType ?? undefined);
        const currentSpeedText = connectionSpeedMbps !== null ? formatMbps(connectionSpeedMbps) : 'Not reported';
        const requiredSpeedText = requiredSpeedMbps !== null
            ? `~${formatMbps(requiredSpeedMbps)}`
            : videoSource.type === 'iframe'
                ? 'Not available'
                : 'Measuring...';

        let status: ReviewConnectionInsight['status'] = 'unknown';
        let statusLabel = videoSource.type === 'iframe' ? 'Estimate only' : 'Measuring';

        if (isBuffering) {
            status = 'poor';
            statusLabel = 'Buffering';
        } else if (connectionSpeedMbps !== null && requiredSpeedMbps !== null) {
            if (connectionSpeedMbps >= requiredSpeedMbps * 1.25) {
                status = 'good';
                statusLabel = 'Good';
            } else if (connectionSpeedMbps >= requiredSpeedMbps) {
                status = 'warning';
                statusLabel = 'May buffer';
            } else {
                status = 'poor';
                statusLabel = 'Too slow';
            }
        } else if (requiredSpeedMbps !== null) {
            status = 'unknown';
            statusLabel = 'Estimate only';
        }

        if (!isBuffering && bufferingEvents > 0 && status !== 'poor') {
            status = 'warning';
            statusLabel = 'Unstable';
        }

        const helperParts: string[] = [];

        if (connectionLabel !== 'Internet') {
            helperParts.push(`Connection detected as ${connectionLabel}.`);
        } else if (effectiveConnectionType && !connectionType) {
            helperParts.push(`Browser reported a ${formatEffectiveType(effectiveConnectionType)} quality estimate, but not whether it is Wi-Fi or mobile data.`);
        }

        if (isBuffering) {
            helperParts.push('Playback is currently buffering.');
        } else if (bufferingEvents > 0) {
            helperParts.push(`Buffering seen ${bufferingEvents} time${bufferingEvents === 1 ? '' : 's'} in this review.`);
        }

        if (videoSource.type === 'iframe') {
            helperParts.push('This embedded player hides the exact bitrate, so only the browser connection estimate is available.');
        } else if (connectionSpeedMbps !== null && requiredSpeedMbps !== null) {
            if (bufferingEvents > 0 && connectionSpeedMbps >= requiredSpeedMbps * 1.25) {
                helperParts.push('The browser estimate looks healthy, but the connection has still dipped during playback.');
            } else if (connectionSpeedMbps >= requiredSpeedMbps * 1.25) {
                helperParts.push('This connection should be enough for smooth playback.');
            } else if (connectionSpeedMbps >= requiredSpeedMbps) {
                helperParts.push('This connection is close to the minimum and may buffer if it dips.');
            } else {
                helperParts.push('This connection is below the recommended speed for smooth playback.');
            }
        } else if (requiredSpeedMbps !== null) {
            helperParts.push(connectionSpeedSupported
                ? 'The browser is not exposing a usable downlink estimate right now, so we can only show the recommended speed.'
                : 'This browser does not report internet speed, so we can only show the recommended speed.'
            );
        } else {
            helperParts.push('We are still measuring this video so the smooth-playback requirement can be calculated.');
        }

        return {
            status,
            statusLabel,
            connectionLabel,
            currentSpeedText,
            requiredSpeedText,
            helperText: helperParts.join(' '),
        };
    }, [
        bufferingEvents,
        connectionType,
        connectionSpeedMbps,
        connectionSpeedSupported,
        effectiveConnectionType,
        isBuffering,
        requiredSpeedMbps,
        videoSource.type,
    ]);

    /* ── Auto-retry on video error ── */
    const handleVideoError = useCallback(() => {
        if (videoRetryCountRef.current < MAX_VIDEO_RETRIES) {
            videoRetryCountRef.current++;
            console.log(`[Video] Retry ${videoRetryCountRef.current}/${MAX_VIDEO_RETRIES}...`);
            setTimeout(() => {
                setRetryKey(Date.now());
            }, 1500);
        } else {
            setVideoError(true);
        }
    }, []);

    useEffect(() => {
        const nav = navigator as Navigator & {
            connection?: NetworkInformationLike;
            mozConnection?: NetworkInformationLike;
            webkitConnection?: NetworkInformationLike;
        };
        const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

        if (!connection) {
            setConnectionSpeedSupported(false);
            setConnectionSpeedMbps(null);
            return;
        }

        const updateConnectionSpeed = () => {
            const downlink = typeof connection.downlink === 'number' && Number.isFinite(connection.downlink)
                ? connection.downlink
                : null;

            setConnectionSpeedSupported(downlink !== null);
            setConnectionSpeedMbps(downlink);
            setConnectionType(typeof connection.type === 'string' ? connection.type : null);
            setEffectiveConnectionType(typeof connection.effectiveType === 'string' ? connection.effectiveType : null);
        };

        updateConnectionSpeed();
        connection.addEventListener?.('change', updateConnectionSpeed);

        return () => {
            connection.removeEventListener?.('change', updateConnectionSpeed);
        };
    }, []);

    /* ── Initialise on asset change ── */
    useEffect(() => {
        if (!asset) return;
        setCurrentVersion(asset.currentVersion);
        // If a lighter review encode exists, prefer it as the starting source
        setCurrentVideoUrl(asset.reviewVideoUrl || asset.videoUrl);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setMeasuredResolution('');
        setConfirmFinal(false);
        setShowApprovalSuccess(false);
        setShowRevisionSuccess(false);
        setVideoError(false);
        setRetryKey(0);
        videoRetryCountRef.current = 0;
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

    useEffect(() => {
        setBufferingEvents(0);
        setIsBuffering(false);
        lastBufferEventRef.current = 0;
    }, [asset?.id, currentVersion, videoSource.src]);

    useEffect(() => {
        if (!open || videoSource.type !== 'video') {
            setIsBuffering(false);
            return;
        }

        const video = videoRef.current;
        if (!video) return;

        const markBuffering = () => {
            if (video.paused || video.seeking || video.currentTime <= 0) return;

            const now = Date.now();
            if (now - lastBufferEventRef.current >= BUFFER_EVENT_COOLDOWN_MS) {
                lastBufferEventRef.current = now;
                setBufferingEvents(prev => prev + 1);
            }

            setIsBuffering(true);
        };

        const clearBuffering = () => setIsBuffering(false);

        video.addEventListener('waiting', markBuffering);
        video.addEventListener('stalled', markBuffering);
        video.addEventListener('playing', clearBuffering);
        video.addEventListener('canplay', clearBuffering);
        video.addEventListener('pause', clearBuffering);

        return () => {
            video.removeEventListener('waiting', markBuffering);
            video.removeEventListener('stalled', markBuffering);
            video.removeEventListener('playing', clearBuffering);
            video.removeEventListener('canplay', clearBuffering);
            video.removeEventListener('pause', clearBuffering);
        };
    }, [open, videoError, videoSource.type, videoSource.src, viewMode]);

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
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play().catch(err => {
                if (err.name !== 'AbortError') console.error('Video play failed:', err);
            });
        } else {
            video.pause();
        }
    }, []);


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
            setDuration(0);
            setMeasuredResolution('');
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
    };

    const handleCommentResolve = useCallback((id: string, resolved: boolean) => {
        setComments(prev => prev.map(c => c.id === id ? { ...c, resolved } : c));
    }, []);

    const handleCommentDelete = useCallback((id: string) => {
        setComments(prev => prev.filter(c => c.id !== id));
    }, []);

    const handleCommentEdit = useCallback(async (id: string, newContent: string) => {
        // Update local state immediately
        setComments(prev => prev.map(c => c.id === id ? { ...c, content: newContent } : c));

        // If it's a real database ID (numerical or UUID, not a Date.now() string), persist it
        // Note: Our temporary IDs are Date.now().toString(), but database IDs are usually UUIDs
        // Alternatively, we can just try to update it and ignore if it's not found (unsaved session comments)
        const isPersisted = id.length > 15; // Simple heuristic for UUID vs Date.now() string

        if (isPersisted) {
            try {
                const res = await fetch(`/api/tasks/${taskId || asset?.id}/feedback`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedbackId: id, feedback: newContent }),
                });
                if (!res.ok) throw new Error('Failed to persist edit');
            } catch (error) {
                console.error('Error persisting comment edit:', error);
                toast.error('Failed to save edit to server');
            }
        }
    }, [taskId, asset?.id]);

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
            
            // Only send comments that haven't been saved yet
            // DB IDs are CUIDs (start with 'c' and are ~25 chars), local IDs are Date.now() strings (numeric, ~13 chars)
            const unsavedComments = feedbackComments.filter(c => {
                // Check if this is a local (unsaved) comment
                const isLocalId = /^\d+$/.test(c.id) && c.id.length < 20;
                return isLocalId && !c.resolved;
            });
            
            if (unsavedComments.length === 0) {
                console.log('✅ No new comments to save');
                return true;
            }
            
            const items = unsavedComments.map(c => {
                const ver = asset?.versions.find(v => parseInt(v.number) === (c.version || currentVersionNumber));
                return {
                    folderType: currentFileSection?.folderType || 'main',
                    fileId: ver?.id || currentFileSection?.fileId || null,
                    feedback: c.content,
                    timestamp: c.timestamp,
                    category: c.category,
                };
            });
            
            console.log(`💾 Saving ${items.length} new comments (${feedbackComments.length - unsavedComments.length} already saved)`);
            
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
        // Prevent double-submit
        if (savingFeedback) return;
        
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

    const handleManualOptimize = async () => {
        if (!asset || isOptimizing) return;

        setIsOptimizing(true);
        const loadingToast = toast.loading('🚀 Optimizing video for review...');

        try {
            const fileId = currentVersion || asset.currentVersion;
            const response = await fetch(`/api/files/${fileId}/optimize`, {
                method: 'POST',
            });

            const data = await response.json();

            if (response.status === 202 || data.success) {
                toast.success('🚀 Optimization Started', {
                    description: 'The review version is being prepared in the background. This may take a few minutes.',
                    id: loadingToast
                });
            } else {
                toast.error('❌ Optimization Failed', {
                    description: data.error || data.details || 'Check server logs for details',
                    id: loadingToast
                });
            }
        } catch (error) {
            toast.error('❌ Network Error', {
                description: 'Failed to connect to optimization service',
                id: loadingToast
            });
        } finally {
            setIsOptimizing(false);
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
            // Use the download API for S3 files — generates a presigned URL
            // and redirects the browser's native download manager (full speed)
            const fileId = currentVersion || asset.currentVersion;
            const isS3 = asset.videoUrl?.includes('amazonaws.com') || asset.videoUrl?.includes('r2.cloudflarestorage.com') || asset.videoUrl?.includes('r2.dev');

            if (isS3 && fileId) {
                // Open in new tab — browser will redirect to presigned S3 download URL
                window.open(`/api/files/${fileId}/download`, '_blank');
                toast.success('Download started');
            } else {
                // Fallback for non-S3 files (Google Drive, etc.)
                const a = document.createElement('a');
                a.href = asset.videoUrl;
                a.download = `${asset.title.replace(/\s+/g, '_')}_V${asset.currentVersion}.mp4`;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast.success('Download started');
            }
        } catch {
            toast.error('Failed to start download');
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
        isOptimizing,
        confirmFinal,
        savingFeedback,
        showApprovalSuccess,
        showRevisionSuccess,
        showInfoPanel,
        shareLink,
        generatingLink,
        linkCopied,
        showShareDialog,
        connectionInsight,
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
        handleCommentEdit,
        handleStatusChange,
        handleManualOptimize,
        setShowCommentInput,
        setConfirmFinal,
        setShowInfoPanel,
        setShowShareDialog,
        setVideoError,
        handleVideoError,
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
