'use client';

import {
    useState,
    useRef,
    useEffect,
    useImperativeHandle,
    forwardRef,
    useCallback,
} from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ReviewComment, COMMENT_CATEGORIES, CommentCategory } from './types';
import {
    Plus, Send, X, Camera, Crop, Clock, Mic, Square, FileIcon,
} from 'lucide-react';

import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

const MAX_SCREENSHOT_WIDTH = 1280;
const MAX_SCREENSHOT_HEIGHT = 720;

// Either a video frame or a static image can be the capture source.
type CaptureSource = HTMLVideoElement | HTMLImageElement;

export type CommentInputHandle = {
    /** Expand the comment composer (Comment pill). */
    openComment: () => void;
    /** Expand and enable timestamp-range mode. */
    toggleRange: () => void;
    /** Expand and start voice recording immediately. */
    startVoice: () => void;
    /** Expand and open the file picker immediately. */
    openAttach: () => void;
    /** Set / clear the screenshot attached to the draft comment. */
    setScreenshot: (url: string | null) => void;
    /** Capture the full current frame into the draft (no snip). */
    captureFullFrame: () => void;
};

export type CommentInputHandle = {
    /** Expand the comment composer (Comment pill). */
    openComment: () => void;
    /** Expand and enable timestamp-range mode. */
    toggleRange: () => void;
    /** Expand and start voice recording immediately. */
    startVoice: () => void;
    /** Expand and open the file picker immediately. */
    openAttach: () => void;
    /** Set / clear the screenshot attached to the draft comment. */
    setScreenshot: (url: string | null) => void;
    /** Capture the full current frame into the draft (no snip). */
    captureFullFrame: () => void;
};

// Helper to format seconds to timestamp string (e.g., 90 -> "1:30")
function formatSecondsToTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper to parse timestamp string to seconds (e.g., "1:30" -> 90)
function parseTimestampToSeconds(timestamp: string): number | null {
    const match = timestamp.match(/^(\d+):(\d{2})$/);
    if (!match) return null;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    if (secs >= 60) return null;
    return mins * 60 + secs;
}

/** Capture a full frame from a video/image element as a JPEG data URL. */
export function captureFullFrameFromSource(
    source: CaptureSource,
    opts?: { maxW?: number; maxH?: number }
): string | null {
    const maxW = opts?.maxW ?? MAX_SCREENSHOT_WIDTH;
    const maxH = opts?.maxH ?? MAX_SCREENSHOT_HEIGHT;
    const canvas = document.createElement('canvas');
    const isVideo = source instanceof HTMLVideoElement;
    const sourceW = isVideo
        ? ((source as HTMLVideoElement).videoWidth || source.clientWidth)
        : ((source as HTMLImageElement).naturalWidth || source.clientWidth);
    const sourceH = isVideo
        ? ((source as HTMLVideoElement).videoHeight || source.clientHeight)
        : ((source as HTMLImageElement).naturalHeight || source.clientHeight);
    if (!sourceW || !sourceH) return null;

    const scale = Math.min(maxW / sourceW, maxH / sourceH, 1);
    const targetW = Math.max(1, Math.round(sourceW * scale));
    const targetH = Math.max(1, Math.round(sourceH * scale));
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    try {
        ctx.drawImage(source, 0, 0, sourceW, sourceH, 0, 0, targetW, targetH);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (err) {
        console.error('Failed to capture screenshot:', err);
        return null;
    }
}

/**
 * Capture a (possibly cropped) region from a video/image element. `area` is
 * in the element's on-screen display coordinates (e.g. from a drag
 * selection) — mapped into the source's intrinsic pixel space before
 * cropping. Used by the Snip tool; omit `area` for a full-frame capture.
 */
function captureAreaFromSource(
    source: CaptureSource,
    area?: { x: number; y: number; w: number; h: number }
): string | null {
    const canvas = document.createElement('canvas');
    const isVideo = source instanceof HTMLVideoElement;

    const sourceW = isVideo
        ? ((source as HTMLVideoElement).videoWidth || source.clientWidth)
        : ((source as HTMLImageElement).naturalWidth || source.clientWidth);
    const sourceH = isVideo
        ? ((source as HTMLVideoElement).videoHeight || source.clientHeight)
        : ((source as HTMLImageElement).naturalHeight || source.clientHeight);
    const displayW = source.clientWidth;
    const displayH = source.clientHeight;
    if (!sourceW || !sourceH || !displayW || !displayH) return null;

    const scaleX = sourceW / displayW;
    const scaleY = sourceH / displayH;

    const hasArea = area && area.w > 5 && area.h > 5;
    const cropX = hasArea ? area!.x * scaleX : 0;
    const cropY = hasArea ? area!.y * scaleY : 0;
    const cropW = hasArea ? area!.w * scaleX : sourceW;
    const cropH = hasArea ? area!.h * scaleY : sourceH;

    const scale = Math.min(MAX_SCREENSHOT_WIDTH / cropW, MAX_SCREENSHOT_HEIGHT / cropH, 1);
    const targetW = Math.max(1, Math.round(cropW * scale));
    const targetH = Math.max(1, Math.round(cropH * scale));
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    try {
        ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (err) {
        console.error('Failed to capture screenshot:', err);
        return null;
    }
}

interface CommentInputProps {
    taskId: string;
    currentTime: number;
    currentTimestamp: string;
    authorId: string;
    authorName: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    imageRef?: React.RefObject<HTMLImageElement | null>;
    duration?: number;
    currentVersionNumber?: number;
    duration?: number;
    currentVersionNumber?: number;
    onSubmit: (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => void;
    onCancel?: () => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    /**
     * When true, hide the inline Range / Full-capture chrome — Desktop pills
     * drive those actions via the imperative API instead.
     */
    hideInlineTools?: boolean;
    /**
     * When true, hide the inline Range / Full-capture chrome — Desktop pills
     * drive those actions via the imperative API instead.
     */
    hideInlineTools?: boolean;
}

export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput({
export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput({
    taskId,
    currentTime,
    currentTimestamp,
    authorId,
    authorName,
    videoRef,
    imageRef,
    duration = 0,
    currentVersionNumber,
    onSubmit,
    onCancel,
    isExpanded = false,
    onToggleExpand,
    hideInlineTools = false,
}, ref) {
    hideInlineTools = false,
}, ref) {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<CommentCategory['value']>('design');
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Snip (drag-select a partial region to screenshot)
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // Timestamp range state
    const [useEndTimestamp, setUseEndTimestamp] = useState(false);
    const [endTimestampInput, setEndTimestampInput] = useState('');
    const [endTimestampError, setEndTimestampError] = useState<string | null>(null);
    const [rangeStartSeconds, setRangeStartSeconds] = useState<number | null>(null);
    const [isEndTracking, setIsEndTracking] = useState(false);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // File attachment
    const [attachment, setAttachment] = useState<{ name: string; url: string; type: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEndTracking, setIsEndTracking] = useState(false);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // File attachment
    const [attachment, setAttachment] = useState<{ name: string; url: string; type: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const getCaptureSource = (): CaptureSource | null => videoRef?.current || imageRef?.current || null;
    const hasCaptureSource = !!(videoRef || imageRef);

    const stopRecordingCleanup = useCallback(() => {
        try {
            mediaRecorderRef.current?.stop();
        } catch { /* ignore */ }
        mediaRecorderRef.current = null;
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);
    }, []);

    useEffect(() => () => stopRecordingCleanup(), [stopRecordingCleanup]);

    const stopRecordingCleanup = useCallback(() => {
        try {
            mediaRecorderRef.current?.stop();
        } catch { /* ignore */ }
        mediaRecorderRef.current = null;
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);
    }, []);

    useEffect(() => () => stopRecordingCleanup(), [stopRecordingCleanup]);

    // Live-track end timestamp as video plays
    useEffect(() => {
        if (!isEndTracking || !useEndTimestamp) return;
        setEndTimestampInput(formatSecondsToTimestamp(currentTime));
    }, [currentTime, isEndTracking, useEndTimestamp]);

    // Validate end timestamp when it changes
    useEffect(() => {
        if (!useEndTimestamp || !endTimestampInput) {
            setEndTimestampError(null);
            return;
        }


        const endSeconds = parseTimestampToSeconds(endTimestampInput);
        const startSecs = rangeStartSeconds ?? currentTime;
        if (endSeconds === null) {
            setEndTimestampError('Invalid format (use M:SS)');
        } else if (endSeconds <= startSecs) {
            setEndTimestampError('Must be after start time');
        } else if (duration > 0 && endSeconds > duration) {
            setEndTimestampError('Exceeds video length');
        } else {
            setEndTimestampError(null);
        }
    }, [endTimestampInput, useEndTimestamp, currentTime, duration, rangeStartSeconds]);

    useEffect(() => {
        if (isExpanded && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isExpanded]);

    const ensureExpanded = useCallback(() => {
        if (!isExpanded) onToggleExpand?.();
    }, [isExpanded, onToggleExpand]);

    const enableRangeMode = useCallback(() => {
        ensureExpanded();
        setUseEndTimestamp(true);
        setRangeStartSeconds(currentTime);
        setEndTimestampInput(formatSecondsToTimestamp(currentTime));
        setIsEndTracking(true);
    }, [ensureExpanded, currentTime]);

    const disableRangeMode = useCallback(() => {
        setUseEndTimestamp(false);
        setEndTimestampInput('');
        setIsEndTracking(false);
        setRangeStartSeconds(null);
    }, []);

    const captureFullFrame = useCallback(() => {
        const source = videoRef?.current || imageRef?.current || null;
    const ensureExpanded = useCallback(() => {
        if (!isExpanded) onToggleExpand?.();
    }, [isExpanded, onToggleExpand]);

    const enableRangeMode = useCallback(() => {
        ensureExpanded();
        setUseEndTimestamp(true);
        setRangeStartSeconds(currentTime);
        setEndTimestampInput(formatSecondsToTimestamp(currentTime));
        setIsEndTracking(true);
    }, [ensureExpanded, currentTime]);

    const disableRangeMode = useCallback(() => {
        setUseEndTimestamp(false);
        setEndTimestampInput('');
        setIsEndTracking(false);
        setRangeStartSeconds(null);
    }, []);

    const captureFullFrame = useCallback(() => {
        const source = videoRef?.current || imageRef?.current || null;
        if (!source) return;
        window.requestAnimationFrame(() => {
            const dataUrl = captureFullFrameFromSource(source);
            if (dataUrl) setScreenshotUrl(dataUrl);
            const dataUrl = captureFullFrameFromSource(source);
            if (dataUrl) setScreenshotUrl(dataUrl);
        });
    }, [videoRef, imageRef]);
    }, [videoRef, imageRef]);

    const handleStartSnip = useCallback(() => {
        ensureExpanded();
        setIsSelectingArea(true);
        setSelectionRect(null);
    }, [ensureExpanded]);

    const handleSnipMouseDown = (e: ReactMouseEvent) => {
        const container = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - container.left;
        const y = e.clientY - container.top;
        setSelectionStart({ x, y });
        setSelectionRect({ x, y, w: 0, h: 0 });
    };

    const handleSnipMouseMove = (e: ReactMouseEvent) => {
        if (!selectionStart) return;
        const container = e.currentTarget.getBoundingClientRect();
        const curX = e.clientX - container.left;
        const curY = e.clientY - container.top;
        const x = Math.min(curX, selectionStart.x);
        const y = Math.min(curY, selectionStart.y);
        const w = Math.abs(curX - selectionStart.x);
        const h = Math.abs(curY - selectionStart.y);
        setSelectionRect({ x, y, w, h });
    };

    const handleSnipMouseUp = () => {
        const source = getCaptureSource();
        if (!selectionRect || !source) {
            setIsSelectingArea(false);
            setSelectionStart(null);
            return;
        }
        // Tiny drag — treat as a click/cancel rather than a selection.
        if (selectionRect.w < 10 || selectionRect.h < 10) {
            setIsSelectingArea(false);
            setSelectionStart(null);
            return;
        }
        const rect = selectionRect;
        window.requestAnimationFrame(() => {
            const dataUrl = captureAreaFromSource(source, rect);
            if (dataUrl) setScreenshotUrl(dataUrl);
        });
        setIsSelectingArea(false);
        setSelectionStart(null);
    };

    const cancelSnip = useCallback(() => {
        setIsSelectingArea(false);
        setSelectionStart(null);
        setSelectionRect(null);
    }, []);

    const startVoiceRecording = useCallback(async () => {
        ensureExpanded();
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            audioChunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                });
                mediaStreamRef.current?.getTracks().forEach(t => t.stop());
                mediaStreamRef.current = null;
                setIsRecording(false);
            };
            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Microphone access failed:', err);
            setIsRecording(false);
        }
    }, [ensureExpanded, isRecording]);

    const stopVoiceRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        } else {
            stopRecordingCleanup();
        }
    }, [stopRecordingCleanup]);

    const openFilePicker = useCallback(() => {
        ensureExpanded();
        // Defer so the composer is expanded before the picker opens
        window.setTimeout(() => fileInputRef.current?.click(), 0);
    }, [ensureExpanded]);

    useImperativeHandle(ref, () => ({
        openComment: () => ensureExpanded(),
        toggleRange: () => {
            if (useEndTimestamp) {
                ensureExpanded();
                disableRangeMode();
            } else {
                enableRangeMode();
            }
        },
        startVoice: () => {
            void startVoiceRecording();
        },
        openAttach: () => openFilePicker(),
        setScreenshot: (url) => {
            ensureExpanded();
            setScreenshotUrl(url);
        },
        captureFullFrame: () => {
            ensureExpanded();
            captureFullFrame();
        },
    }), [
        ensureExpanded,
        useEndTimestamp,
        disableRangeMode,
        enableRangeMode,
        startVoiceRecording,
        openFilePicker,
        captureFullFrame,
    ]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const url = URL.createObjectURL(file);
        setAttachment(prev => {
            if (prev) URL.revokeObjectURL(prev.url);
            return { name: file.name, url, type: file.type };
        });
    };

    const handleSubmit = async () => {
        if (!content.trim() && !audioUrl && !attachment && !screenshotUrl) return;

        if (!content.trim() && !audioUrl && !attachment && !screenshotUrl) return;

        const startSecs = (useEndTimestamp && rangeStartSeconds !== null) ? rangeStartSeconds : currentTime;
        const startTimestamp = formatSecondsToTimestamp(startSecs);

        if (useEndTimestamp && endTimestampInput) {
            const endSeconds = parseTimestampToSeconds(endTimestampInput);
            if (endSeconds === null || endSeconds <= startSecs) {
                return;
                return;
            }
        }

        setIsSubmitting(true);

        const endSeconds = useEndTimestamp && endTimestampInput
            ? parseTimestampToSeconds(endTimestampInput)

        const endSeconds = useEndTimestamp && endTimestampInput
            ? parseTimestampToSeconds(endTimestampInput)
            : undefined;

        // If content is empty but we have media, invent a short label
        const body = content.trim()
            || (audioUrl ? 'Voice note' : '')
            || (attachment ? `Attached: ${attachment.name}` : '')
            || (screenshotUrl ? 'Frame annotation' : '');

        // If content is empty but we have media, invent a short label
        const body = content.trim()
            || (audioUrl ? 'Voice note' : '')
            || (attachment ? `Attached: ${attachment.name}` : '')
            || (screenshotUrl ? 'Frame annotation' : '');

        const newComment: Omit<ReviewComment, 'id' | 'createdAt'> = {
            taskId,
            authorId,
            authorName,
            timestamp: useEndTimestamp ? startTimestamp : currentTimestamp,
            timestampSeconds: startSecs,
            endTimestamp: endSeconds ? endTimestampInput : undefined,
            endTimestampSeconds: endSeconds ?? undefined,
            content: body,
            category: [category] as ReviewComment['category'],
            content: body,
            category: [category] as ReviewComment['category'],
            screenshotUrl: screenshotUrl || undefined,
            audioUrl: audioUrl || undefined,
            attachmentUrl: attachment?.url,
            attachmentName: attachment?.name,
            audioUrl: audioUrl || undefined,
            attachmentUrl: attachment?.url,
            attachmentName: attachment?.name,
            resolved: false,
            replies: [],
            version: currentVersionNumber,
        };

        await onSubmit(newComment);
        setContent('');
        setScreenshotUrl(null);
        setAudioUrl(null);
        setAttachment(null);
        disableRangeMode();
        setAudioUrl(null);
        setAttachment(null);
        disableRangeMode();
        setIsSubmitting(false);
        onCancel?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            onCancel?.();
        }
    };

    const handleCancel = () => {
        stopRecordingCleanup();
        onCancel?.();
    };

    const handleCancel = () => {
        stopRecordingCleanup();
        onCancel?.();
    };

    if (!isExpanded) {
        return (
            <button
                onClick={onToggleExpand}
                className="w-full p-3 rounded-lg bg-[var(--review-bg-tertiary)] border border-[var(--review-border)] hover:border-[var(--review-accent-purple)] transition-colors flex items-center gap-2 text-[var(--review-text-muted)] hover:text-[var(--review-text-secondary)]"
            >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Add comment at {currentTimestamp}</span>
            </button>
        );
    }

    return (
        <div className="review-comment-input review-animate-fade-in">
            {/* Hidden file input for Attach mode */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Hidden file input for Attach mode */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Timestamp display with optional range */}
                    <div className="flex items-center gap-1">
                        <span className="review-comment-timestamp flex items-center gap-1">
                            {useEndTimestamp && rangeStartSeconds !== null
                                ? formatSecondsToTimestamp(rangeStartSeconds)
                                : currentTimestamp}
                            {useEndTimestamp && rangeStartSeconds !== null
                                ? formatSecondsToTimestamp(rangeStartSeconds)
                                : currentTimestamp}
                        </span>
                        {useEndTimestamp && (
                            <>
                                <span className="text-[var(--review-text-muted)]">–</span>
                                <div className="relative">
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            value={endTimestampInput}
                                            onChange={(e) => {
                                                setIsEndTracking(false);
                                                setIsEndTracking(false);
                                                setEndTimestampInput(e.target.value);
                                            }}
                                            placeholder="M:SS"
                                            className={`w-16 h-6 px-1.5 text-xs bg-[var(--review-bg-elevated)] border rounded text-center font-mono ${
                                                endTimestampError
                                                    ? 'border-red-500 text-red-400'
                                                endTimestampError
                                                    ? 'border-red-500 text-red-400'
                                                    : isEndTracking
                                                        ? 'border-[var(--review-accent-purple)] text-[var(--review-accent-purple)]'
                                                        : 'border-[var(--review-border)] text-white'
                                            }`}
                                        />
                                        {isEndTracking && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--review-accent-purple)] animate-pulse" title="Tracking live" />
                                        )}
                                    </div>
                                    {endTimestampError && (
                                        <div className="absolute top-full left-0 mt-1 text-[10px] text-red-400 whitespace-nowrap">
                                            {endTimestampError}
                                        </div>
                                    )}
                                    {isEndTracking && !endTimestampError && (
                                        <div className="absolute top-full left-0 mt-1 text-[10px] text-[var(--review-accent-purple)] whitespace-nowrap">
                                            Live • click to lock
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={disableRangeMode}
                                    onClick={disableRangeMode}
                                    className="h-5 w-5 p-0 text-[var(--review-text-muted)] hover:text-red-400"
                                    title="Remove end time"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                        {!hideInlineTools && !useEndTimestamp && videoRef && (
                        {!hideInlineTools && !useEndTimestamp && videoRef && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={enableRangeMode}
                                onClick={enableRangeMode}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title="Add end time for a range (e.g., 1:00 - 1:28)"
                            >
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Range</span>
                            </Button>
                        )}
                    </div>
                    {!hideInlineTools && hasCaptureSource && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={captureFullFrame}
                                onClick={captureFullFrame}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title={videoRef ? 'Capture full frame' : 'Capture full image'}
                            >
                                <Camera className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Full</span>
                            </Button>
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    onClick={handleCancel}
                    className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-elevated)]"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Screenshot Preview */}
            {screenshotUrl && (
                <div className="mb-3 relative group w-fit">
                    <img
                        src={screenshotUrl}
                        alt="Captured frame"
                        className="h-24 rounded border border-[var(--review-border)] hover:border-[var(--review-accent-purple)] transition-colors cursor-pointer object-cover"
                    />
                    <button
                        onClick={() => setScreenshotUrl(null)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        title="Remove screenshot"
                    >
                        <X className="h-3 w-3" />
                    </button>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center rounded">
                        <span className="text-[10px] text-white font-bold px-2 py-1 bg-black/60 rounded">Captured</span>
                    </div>
                </div>
            )}

            {/* Voice recording / playback */}
            {(isRecording || audioUrl) && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-elevated)]/60 px-2.5 py-2">
                    {isRecording ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs text-red-300 font-medium flex-1">Recording…</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopVoiceRecording}
                                className="h-7 gap-1 px-2 text-red-300 hover:text-white hover:bg-red-500/20"
                            >
                                <Square className="h-3 w-3 fill-current" />
                                <span className="text-[10px] uppercase font-bold">Stop</span>
                            </Button>
                        </>
                    ) : audioUrl ? (
                        <>
                            <Mic className="h-3.5 w-3.5 text-[var(--review-accent-purple)]" />
                            <audio src={audioUrl} controls className="h-7 flex-1 max-w-[220px]" />
                            <button
                                onClick={() => {
                                    URL.revokeObjectURL(audioUrl);
                                    setAudioUrl(null);
                                }}
                                className="text-[var(--review-text-muted)] hover:text-red-400"
                                title="Remove voice note"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : null}
                </div>
            )}

            {/* Attachment preview */}
            {attachment && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-elevated)]/60 px-2.5 py-2">
                    <FileIcon className="h-3.5 w-3.5 text-[var(--review-accent-purple)] shrink-0" />
                    <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-white truncate flex-1 hover:underline"
                    >
                        {attachment.name}
                    </a>
                    <button
                        onClick={() => {
                            URL.revokeObjectURL(attachment.url);
                            setAttachment(null);
                        }}
                        className="text-[var(--review-text-muted)] hover:text-red-400"
                        title="Remove attachment"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            {/* Voice recording / playback */}
            {(isRecording || audioUrl) && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-elevated)]/60 px-2.5 py-2">
                    {isRecording ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs text-red-300 font-medium flex-1">Recording…</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopVoiceRecording}
                                className="h-7 gap-1 px-2 text-red-300 hover:text-white hover:bg-red-500/20"
                            >
                                <Square className="h-3 w-3 fill-current" />
                                <span className="text-[10px] uppercase font-bold">Stop</span>
                            </Button>
                        </>
                    ) : audioUrl ? (
                        <>
                            <Mic className="h-3.5 w-3.5 text-[var(--review-accent-purple)]" />
                            <audio src={audioUrl} controls className="h-7 flex-1 max-w-[220px]" />
                            <button
                                onClick={() => {
                                    URL.revokeObjectURL(audioUrl);
                                    setAudioUrl(null);
                                }}
                                className="text-[var(--review-text-muted)] hover:text-red-400"
                                title="Remove voice note"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : null}
                </div>
            )}

            {/* Attachment preview */}
            {attachment && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-elevated)]/60 px-2.5 py-2">
                    <FileIcon className="h-3.5 w-3.5 text-[var(--review-accent-purple)] shrink-0" />
                    <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-white truncate flex-1 hover:underline"
                    >
                        {attachment.name}
                    </a>
                    <button
                        onClick={() => {
                            URL.revokeObjectURL(attachment.url);
                            setAttachment(null);
                        }}
                        className="text-[var(--review-text-muted)] hover:text-red-400"
                        title="Remove attachment"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Textarea */}
            <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add your feedback..."
                className="min-h-[80px] bg-transparent border-none resize-none text-white placeholder:text-[var(--review-text-muted)] focus-visible:ring-0 p-0"
            />

            {/* Category Selector */}
            <div className="flex items-center gap-1 mt-3 mb-3 flex-wrap">
                {COMMENT_CATEGORIES.map((cat) => (
                    <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`review-category-pill cursor-pointer transition-all ${category === cat.value
                            ? 'ring-1 ring-offset-1 ring-offset-[var(--review-bg-tertiary)]'
                            : 'opacity-60 hover:opacity-100'
                            }`}
                        data-category={cat.value}
                        style={{
                            '--tw-ring-color': cat.color,
                        } as React.CSSProperties}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--review-border)]">
                <span className="text-xs text-[var(--review-text-muted)]">
                    ⌘/Ctrl + Enter to submit
                </span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        onClick={handleCancel}
                        className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-elevated)]"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={(!content.trim() && !audioUrl && !attachment && !screenshotUrl) || isSubmitting || isRecording}
                        disabled={(!content.trim() && !audioUrl && !attachment && !screenshotUrl) || isSubmitting || isRecording}
                        className="bg-[var(--review-accent-purple)] hover:bg-[var(--review-accent-purple)]/90 text-white"
                    >
                        <Send className="h-4 w-4 mr-1" />
                        Post
                    </Button>
                </div>
            </div>

            {/* Snip: drag-to-select overlay portal, positioned over the video/image */}
            {isSelectingArea && (videoRef?.current?.parentElement || imageRef?.current?.parentElement) && createPortal(
                <div
                    className="absolute inset-0 z-[100] cursor-crosshair bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center"
                    onMouseDown={handleSnipMouseDown}
                    onMouseMove={handleSnipMouseMove}
                    onMouseUp={handleSnipMouseUp}
                >
                    <div className="absolute top-4 bg-black/80 text-white px-3 py-1 rounded text-xs border border-white/20 select-none animate-bounce">
                        Drag to select area
                    </div>
                    {selectionRect && (
                        <div
                            className="absolute border-2 border-dashed border-[var(--review-accent-purple)] bg-[var(--review-accent-purple)]/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                            style={{
                                left: selectionRect.x,
                                top: selectionRect.y,
                                width: selectionRect.w,
                                height: selectionRect.h,
                            }}
                        />
                    )}
                    <button
                        className="absolute bottom-4 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg select-none"
                        onClick={(e) => {
                            e.stopPropagation();
                            cancelSnip();
                        }}
                    >
                        Cancel
                    </button>
                </div>,
                (videoRef?.current?.parentElement || imageRef?.current?.parentElement)!
            )}
        </div>
    );
});