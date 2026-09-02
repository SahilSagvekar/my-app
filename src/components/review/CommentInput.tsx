'use client';

import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ReviewComment, COMMENT_CATEGORIES, CommentCategory, Annotation, CommentAttachment } from './types';
import {
    Plus, Send, X, AtSign, Camera, Crop, Clock,
    Mic, Square as StopIcon, Paperclip, PenTool, Pencil,
    ArrowUpRight, Square as RectIcon, Circle as CircleIcon,
    Undo2, Trash2, Check, Loader2, File as FileIcon, Image as ImageIcon,
} from 'lucide-react';

import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

const MAX_SCREENSHOT_WIDTH = 1280;
const MAX_SCREENSHOT_HEIGHT = 720;
const DRAW_CANVAS_MAX_DISPLAY_WIDTH = 480; // CSS display cap; canvas internal res stays at full screenshot size
const MAX_ATTACHMENT_MB = 25;

const DRAW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#ffffff'];
const STROKE_WIDTHS = [2, 4, 7];

// Either a video frame or a static image can be the capture source.
type CaptureSource = HTMLVideoElement | HTMLImageElement;

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

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}

// Uploads a single File/Blob to R2 via the comment-attachments endpoint.
async function uploadCommentAttachment(
    taskId: string,
    blob: Blob,
    filename: string,
    mimeType: string
): Promise<CommentAttachment> {
    const form = new FormData();
    form.append('file', blob, filename);
    const res = await fetch(`/api/tasks/${taskId}/feedback/attachments`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Attachment upload failed');
    }
    return res.json();
}

interface CommentInputProps {
    taskId: string;
    currentTime: number;
    currentTimestamp: string;
    authorId: string;
    authorName: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    imageRef?: React.RefObject<HTMLImageElement | null>;
    duration?: number; // Video duration for validation
    currentVersionNumber?: number; // Version to stamp on new comments

    onSubmit: (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => void;

    onCancel?: () => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function CommentInput({
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
}: CommentInputProps) {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<CommentCategory['value']>('design');
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    // Timestamp range state
    const [useEndTimestamp, setUseEndTimestamp] = useState(false);
    const [endTimestampInput, setEndTimestampInput] = useState('');
    const [endTimestampError, setEndTimestampError] = useState<string | null>(null);
    const [rangeStartSeconds, setRangeStartSeconds] = useState<number | null>(null);
    const [isEndTracking, setIsEndTracking] = useState(false); // true = end follows video live

    // 🔥 NEW: Voice comment state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [voiceDurationSec, setVoiceDurationSec] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const voiceMimeTypeRef = useRef('audio/webm');

    // 🔥 NEW: File / image attachment state
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🔥 NEW: Frame.io-style drawing/annotation state
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [activeTool, setActiveTool] = useState<Annotation['type']>('freehand');
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
    const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);
    const [currentPoints, setCurrentPoints] = useState<{ x: number, y: number }[] | null>(null);
    const [drawCanvasSize, setDrawCanvasSize] = useState({ w: 0, h: 0 });
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawImageRef = useRef<HTMLImageElement | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // The active capture element — whichever ref was passed in.
    const getCaptureSource = (): CaptureSource | null => videoRef?.current || imageRef?.current || null;
    const hasCaptureSource = !!(videoRef || imageRef);

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

    // Clean up mic stream / timers / object URLs if the component unmounts mid-recording
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
            if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const captureArea = (source: CaptureSource, area?: { x: number, y: number, w: number, h: number }) => {
        const canvas = document.createElement('canvas');

        const isVideo = source instanceof HTMLVideoElement;

        // Use intrinsic source dimensions — videoWidth/videoHeight for video,
        // naturalWidth/naturalHeight for a static image.
        const sourceW = isVideo ? ((source as HTMLVideoElement).videoWidth || source.clientWidth) : ((source as HTMLImageElement).naturalWidth || source.clientWidth);
        const sourceH = isVideo ? ((source as HTMLVideoElement).videoHeight || source.clientHeight) : ((source as HTMLImageElement).naturalHeight || source.clientHeight);
        const displayW = source.clientWidth;
        const displayH = source.clientHeight;

        // Fallback if we can't determine sizes
        if (!sourceW || !sourceH || !displayW || !displayH) {
            return;
        }

        // Map selection (if any) from display space to source space
        const scaleX = sourceW / displayW;
        const scaleY = sourceH / displayH;

        const hasArea = area && area.w > 5 && area.h > 5;
        const cropX = hasArea ? area!.x * scaleX : 0;
        const cropY = hasArea ? area!.y * scaleY : 0;
        const cropW = hasArea ? area!.w * scaleX : sourceW;
        const cropH = hasArea ? area!.h * scaleY : sourceH;

        // Downscale to keep thumbnails light (CPU + memory)
        const scale = Math.min(
            MAX_SCREENSHOT_WIDTH / cropW,
            MAX_SCREENSHOT_HEIGHT / cropH,
            1
        );

        const targetW = Math.max(1, Math.round(cropW * scale));
        const targetH = Math.max(1, Math.round(cropH * scale));

        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(
            source,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            targetW,
            targetH
        );

        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setScreenshotUrl(dataUrl);
            setAnnotations([]); // fresh capture — drop any stale drawing from a previous screenshot
        } catch (err) {
            console.error('Failed to capture screenshot:', err);
        }
    };

    const handleCapture = () => {
        const source = getCaptureSource();
        if (!source) return;

        // Defer heavy canvas work off the exact playback tick
        window.requestAnimationFrame(() => {
            captureArea(source);
        });
    };

    const handleStartSnip = () => {
        setIsSelectingArea(true);
        setSelectionRect(null);
    };

    const handleMouseDown = (e: ReactMouseEvent) => {
        const container = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - container.left;
        const y = e.clientY - container.top;
        setSelectionStart({ x, y });
        setSelectionRect({ x, y, w: 0, h: 0 });
    };

    const handleMouseMove = (e: ReactMouseEvent) => {
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

    const handleMouseUp = () => {
        const source = getCaptureSource();
        if (!selectionRect || !source) {
            setIsSelectingArea(false);
            setSelectionStart(null);
            return;
        }

        // If selection is tiny, treat as click/cancel
        if (selectionRect.w < 10 || selectionRect.h < 10) {
            setIsSelectingArea(false);
            setSelectionStart(null);
            return;
        }

        // Defer heavy canvas work off the exact playback tick
        window.requestAnimationFrame(() => {
            captureArea(source, selectionRect);
        });
        setIsSelectingArea(false);
        setSelectionStart(null);
    };

    /* ─── NEW: Voice recording ─────────────────────────────────── */

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
            voiceMimeTypeRef.current = mimeType || 'audio/webm';

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: voiceMimeTypeRef.current });
                setRecordedBlob(blob);
                setRecordedPreviewUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach((t) => t.stop());
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingSeconds(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds((s) => s + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone access failed:', err);
            toast.error('Could not access microphone — check browser permissions');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setVoiceDurationSec(recordingSeconds);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };

    const discardVoiceNote = () => {
        if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
        setRecordedBlob(null);
        setRecordedPreviewUrl(null);
        setRecordingSeconds(0);
        setVoiceDurationSec(0);
    };

    /* ─── NEW: File / image attachments ────────────────────────── */

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
        if (tooBig.length > 0) {
            toast.error(`${tooBig.length > 1 ? 'Some files exceed' : `"${tooBig[0].name}" exceeds`} the ${MAX_ATTACHMENT_MB}MB limit`);
        }
        const ok = files.filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024);
        setAttachedFiles((prev) => [...prev, ...ok]);
        e.target.value = '';
    };

    const removeAttachedFile = (idx: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    /* ─── NEW: Drawing / annotation tool ───────────────────────── */

    // Load the captured screenshot into an offscreen Image once draw mode opens
    useEffect(() => {
        if (!isDrawMode || !screenshotUrl) return;
        const img = new Image();
        img.onload = () => {
            drawImageRef.current = img;
            setDrawCanvasSize({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.src = screenshotUrl;
    }, [isDrawMode, screenshotUrl]);

    const drawAnnotation = (ctx: CanvasRenderingContext2D, a: Annotation, w: number, h: number) => {
        ctx.strokeStyle = a.color;
        ctx.fillStyle = a.color;
        ctx.lineWidth = a.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const toPx = (p: { x: number, y: number }) => ({ x: p.x * w, y: p.y * h });

        if (a.type === 'freehand') {
            if (a.points.length < 2) return;
            ctx.beginPath();
            const start = toPx(a.points[0]);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < a.points.length; i++) {
                const pt = toPx(a.points[i]);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        } else if (a.type === 'rectangle') {
            if (a.points.length < 2) return;
            const p1 = toPx(a.points[0]);
            const p2 = toPx(a.points[1]);
            ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        } else if (a.type === 'circle') {
            if (a.points.length < 2) return;
            const p1 = toPx(a.points[0]);
            const p2 = toPx(a.points[1]);
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const rx = Math.abs(p2.x - p1.x) / 2;
            const ry = Math.abs(p2.y - p1.y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (a.type === 'arrow') {
            if (a.points.length < 2) return;
            const p1 = toPx(a.points[0]);
            const p2 = toPx(a.points[1]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const headLen = 8 + a.strokeWidth * 2;
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
        }
    };

    const redrawCanvas = () => {
        const canvas = drawCanvasRef.current;
        const img = drawImageRef.current;
        if (!canvas || !img || !drawCanvasSize.w) return;
        canvas.width = drawCanvasSize.w;
        canvas.height = drawCanvasSize.h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const allStrokes = [...annotations];
        if (currentPoints && currentPoints.length > 0) {
            allStrokes.push({
                id: '__preview__',
                type: activeTool,
                points: currentPoints,
                color: drawColor,
                strokeWidth,
                timestampSeconds: currentTime,
            });
        }
        allStrokes.forEach((a) => drawAnnotation(ctx, a, canvas.width, canvas.height));
    };

    useEffect(() => {
        redrawCanvas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawCanvasSize, annotations, currentPoints, activeTool, drawColor, strokeWidth]);

    const getRelativePoint = (e: ReactMouseEvent<HTMLCanvasElement>): { x: number, y: number } => {
        const canvas = drawCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
        };
    };

    const handleDrawPointerDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
        const pt = getRelativePoint(e);
        setCurrentPoints(activeTool === 'freehand' ? [pt] : [pt, pt]);
    };

    const handleDrawPointerMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
        if (!currentPoints) return;
        const pt = getRelativePoint(e);
        if (activeTool === 'freehand') {
            setCurrentPoints((prev) => [...(prev || []), pt]);
        } else {
            setCurrentPoints((prev) => (prev ? [prev[0], pt] : [pt, pt]));
        }
    };

    const handleDrawPointerUp = () => {
        if (!currentPoints || currentPoints.length < 2) {
            setCurrentPoints(null);
            return;
        }
        setAnnotations((prev) => [
            ...prev,
            {
                id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: activeTool,
                points: currentPoints,
                color: drawColor,
                strokeWidth,
                timestampSeconds: currentTime,
            },
        ]);
        setCurrentPoints(null);
    };

    const undoAnnotation = () => setAnnotations((prev) => prev.slice(0, -1));
    const clearAnnotations = () => setAnnotations([]);

    const finishDrawing = () => {
        const canvas = drawCanvasRef.current;
        if (canvas) {
            try {
                const flattened = canvas.toDataURL('image/jpeg', 0.85);
                setScreenshotUrl(flattened);
            } catch (err) {
                console.error('Failed to flatten drawing onto screenshot:', err);
            }
        }
        setIsDrawMode(false);
    };

    const cancelDrawing = () => {
        setIsDrawMode(false);
        setCurrentPoints(null);
    };

    /* ─── Submit ───────────────────────────────────────────────────── */

    const handleSubmit = async () => {
        if (!content.trim()) return;

        // Use frozen start if range mode, otherwise current time
        const startSecs = (useEndTimestamp && rangeStartSeconds !== null) ? rangeStartSeconds : currentTime;
        const startTimestamp = formatSecondsToTimestamp(startSecs);

        // Validate end timestamp if enabled
        if (useEndTimestamp && endTimestampInput) {
            const endSeconds = parseTimestampToSeconds(endTimestampInput);
            if (endSeconds === null || endSeconds <= startSecs) {
                return; // Don't submit with invalid end timestamp
            }
        }

        setIsSubmitting(true);

        try {
            // Build end timestamp data if enabled and valid
            const endSeconds = useEndTimestamp && endTimestampInput
                ? parseTimestampToSeconds(endTimestampInput)
                : undefined;

            // Upload any pending attachments to R2 before creating the comment.
            let finalScreenshotUrl = screenshotUrl || undefined;
            if (finalScreenshotUrl && finalScreenshotUrl.startsWith('data:')) {
                const blob = await dataUrlToBlob(finalScreenshotUrl);
                const uploaded = await uploadCommentAttachment(
                    taskId, blob, `screenshot-${Date.now()}.jpg`, 'image/jpeg'
                );
                finalScreenshotUrl = uploaded.url;
            }

            let finalVoiceUrl: string | undefined;
            if (recordedBlob) {
                const ext = voiceMimeTypeRef.current.includes('mp4') ? 'm4a' : 'webm';
                const uploaded = await uploadCommentAttachment(
                    taskId, recordedBlob, `voice-${Date.now()}.${ext}`, voiceMimeTypeRef.current
                );
                finalVoiceUrl = uploaded.url;
            }

            let finalAttachments: CommentAttachment[] | undefined;
            if (attachedFiles.length > 0) {
                finalAttachments = await Promise.all(
                    attachedFiles.map((f) => uploadCommentAttachment(taskId, f, f.name, f.type))
                );
            }

            const newComment: Omit<ReviewComment, 'id' | 'createdAt'> = {
                taskId,
                authorId,
                authorName,
                timestamp: useEndTimestamp ? startTimestamp : currentTimestamp,
                timestampSeconds: startSecs,
                endTimestamp: endSeconds ? endTimestampInput : undefined,
                endTimestampSeconds: endSeconds ?? undefined,
                content: content.trim(),
                category,
                screenshotUrl: finalScreenshotUrl,
                annotations: annotations.length > 0 ? annotations : undefined,
                voiceUrl: finalVoiceUrl,
                voiceDurationSec: finalVoiceUrl ? voiceDurationSec : undefined,
                attachments: finalAttachments,
                resolved: false,
                replies: [],
                version: currentVersionNumber,
            };

            await onSubmit(newComment);

            setContent('');
            setScreenshotUrl(null);
            setAnnotations([]);
            setUseEndTimestamp(false);
            setEndTimestampInput('');
            setIsEndTracking(false);
            setRangeStartSeconds(null);
            discardVoiceNote();
            setAttachedFiles([]);
        } catch (err: any) {
            console.error('Failed to submit comment:', err);
            toast.error(err?.message || 'Failed to post comment — please try again');
        } finally {
            setIsSubmitting(false);
            onCancel?.();
        }
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
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Timestamp display with optional range */}
                    <div className="flex items-center gap-1">
                        <span className="review-comment-timestamp flex items-center gap-1">
                            {useEndTimestamp && rangeStartSeconds !== null ? formatSecondsToTimestamp(rangeStartSeconds) : currentTimestamp}
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
                                                setIsEndTracking(false); // manual edit stops live tracking
                                                setEndTimestampInput(e.target.value);
                                            }}
                                            placeholder="M:SS"
                                            className={`w-16 h-6 px-1.5 text-xs bg-[var(--review-bg-elevated)] border rounded text-center font-mono ${
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
                                    onClick={() => {
                                        setUseEndTimestamp(false);
                                        setEndTimestampInput('');
                                        setIsEndTracking(false);
                                        setRangeStartSeconds(null);
                                    }}
                                    className="h-5 w-5 p-0 text-[var(--review-text-muted)] hover:text-red-400"
                                    title="Remove end time"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                        {!useEndTimestamp && videoRef && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setUseEndTimestamp(true);
                                    setRangeStartSeconds(currentTime); // freeze start at this moment
                                    setEndTimestampInput(formatSecondsToTimestamp(currentTime));
                                    setIsEndTracking(true); // end follows video live
                                }}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title="Add end time for a range (e.g., 1:00 - 1:28)"
                            >
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Range</span>
                            </Button>
                        )}
                    </div>
                    {hasCaptureSource && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCapture}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title={videoRef ? 'Capture full frame' : 'Capture full image'}
                            >
                                <Camera className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Full</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleStartSnip}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title="Select area to snip"
                            >
                                <Crop className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Snip</span>
                            </Button>
                            {screenshotUrl && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsDrawMode(true)}
                                    className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                    title="Draw / annotate the captured frame"
                                >
                                    <PenTool className="h-3.5 w-3.5" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Draw</span>
                                </Button>
                            )}
                        </div>
                    )}
                    {/* NEW: Voice + attach controls */}
                    <div className="flex items-center gap-1">
                        {!isRecording ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={startRecording}
                                disabled={!!recordedBlob}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)] disabled:opacity-40"
                                title="Record a voice comment"
                            >
                                <Mic className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Voice</span>
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopRecording}
                                className="h-6 gap-1 px-2 text-red-400 hover:text-red-300 hover:bg-[var(--review-bg-elevated)]"
                                title="Stop recording"
                            >
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-[10px] font-mono">{formatDuration(recordingSeconds)}</span>
                                <StopIcon className="h-3 w-3 ml-0.5" />
                            </Button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFilesSelected}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                            title="Attach files or images"
                        >
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Attach</span>
                        </Button>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-elevated)]"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* NEW: Drawing panel — replaces the small screenshot thumbnail while active */}
            {isDrawMode && screenshotUrl ? (
                <div className="mb-3 rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-elevated)] p-2 w-fit">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-0.5 bg-black/20 rounded p-0.5">
                            {([
                                { tool: 'freehand' as const, Icon: Pencil, title: 'Pen' },
                                { tool: 'arrow' as const, Icon: ArrowUpRight, title: 'Arrow' },
                                { tool: 'rectangle' as const, Icon: RectIcon, title: 'Rectangle' },
                                { tool: 'circle' as const, Icon: CircleIcon, title: 'Circle' },
                            ]).map(({ tool, Icon, title }) => (
                                <button
                                    key={tool}
                                    onClick={() => setActiveTool(tool)}
                                    title={title}
                                    className={`h-6 w-6 flex items-center justify-center rounded ${
                                        activeTool === tool
                                            ? 'bg-[var(--review-accent-purple)] text-white'
                                            : 'text-[var(--review-text-muted)] hover:text-white'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                            {DRAW_COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setDrawColor(c)}
                                    title={c}
                                    className={`h-4 w-4 rounded-full border ${drawColor === c ? 'ring-2 ring-offset-1 ring-offset-[var(--review-bg-elevated)] ring-white' : 'border-white/20'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                            {STROKE_WIDTHS.map((w) => (
                                <button
                                    key={w}
                                    onClick={() => setStrokeWidth(w)}
                                    title={`${w}px`}
                                    className={`h-6 w-6 flex items-center justify-center rounded ${strokeWidth === w ? 'bg-white/10' : ''}`}
                                >
                                    <span
                                        className="rounded-full bg-white"
                                        style={{ width: w + 2, height: w + 2 }}
                                    />
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-0.5 ml-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={undoAnnotation}
                                disabled={annotations.length === 0}
                                className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-white disabled:opacity-30"
                                title="Undo last stroke"
                            >
                                <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAnnotations}
                                disabled={annotations.length === 0}
                                className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-red-400 disabled:opacity-30"
                                title="Clear all drawing"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <canvas
                        ref={drawCanvasRef}
                        className="rounded border border-[var(--review-border)] cursor-crosshair block"
                        style={{ width: '100%', maxWidth: DRAW_CANVAS_MAX_DISPLAY_WIDTH, touchAction: 'none' }}
                        onMouseDown={handleDrawPointerDown}
                        onMouseMove={handleDrawPointerMove}
                        onMouseUp={handleDrawPointerUp}
                        onMouseLeave={handleDrawPointerUp}
                    />

                    <div className="flex items-center justify-end gap-2 mt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelDrawing}
                            className="h-6 px-2 text-xs text-[var(--review-text-muted)] hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={finishDrawing}
                            className="h-6 px-2 text-xs bg-[var(--review-accent-purple)] hover:bg-[var(--review-accent-purple)]/90 text-white gap-1"
                        >
                            <Check className="h-3 w-3" />
                            Done
                        </Button>
                    </div>
                </div>
            ) : (
                /* Screenshot Preview */
                screenshotUrl && (
                    <div className="mb-3 relative group w-fit">
                        <img
                            src={screenshotUrl}
                            alt="Captured frame"
                            className="h-24 rounded border border-[var(--review-border)] hover:border-[var(--review-accent-purple)] transition-colors cursor-pointer object-cover"
                        />
                        <button
                            onClick={() => { setScreenshotUrl(null); setAnnotations([]); }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="Remove screenshot"
                        >
                            <X className="h-3 w-3" />
                        </button>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center rounded">
                            <span className="text-[10px] text-white font-bold px-2 py-1 bg-black/60 rounded">
                                {annotations.length > 0 ? 'Annotated' : 'Captured'}
                            </span>
                        </div>
                    </div>
                )
            )}

            {/* NEW: Voice note preview */}
            {recordedPreviewUrl && (
                <div className="mb-3 flex items-center gap-2 bg-[var(--review-bg-elevated)] border border-[var(--review-border)] rounded-lg px-2 py-1.5 w-fit">
                    <Mic className="h-3.5 w-3.5 text-[var(--review-accent-purple)]" />
                    <audio controls src={recordedPreviewUrl} className="h-8" style={{ maxWidth: 220 }} />
                    <span className="text-[10px] text-[var(--review-text-muted)] font-mono">{formatDuration(voiceDurationSec)}</span>
                    <button
                        onClick={discardVoiceNote}
                        className="text-[var(--review-text-muted)] hover:text-red-400"
                        title="Remove voice note"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* NEW: Attached files list */}
            {attachedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {attachedFiles.map((f, idx) => (
                        <div
                            key={`${f.name}-${idx}`}
                            className="flex items-center gap-1.5 bg-[var(--review-bg-elevated)] border border-[var(--review-border)] rounded-lg pl-2 pr-1 py-1"
                        >
                            {f.type.startsWith('image/') ? (
                                <ImageIcon className="h-3.5 w-3.5 text-[var(--review-accent-purple)]" />
                            ) : (
                                <FileIcon className="h-3.5 w-3.5 text-[var(--review-text-muted)]" />
                            )}
                            <span className="text-xs text-[var(--review-text-secondary)] max-w-[140px] truncate">{f.name}</span>
                            <span className="text-[10px] text-[var(--review-text-muted)]">{formatFileSize(f.size)}</span>
                            <button
                                onClick={() => removeAttachedFile(idx)}
                                className="text-[var(--review-text-muted)] hover:text-red-400 ml-0.5"
                                title="Remove attachment"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
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
                        onClick={onCancel}
                        className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-elevated)]"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!content.trim() || isSubmitting}
                        className="bg-[var(--review-accent-purple)] hover:bg-[var(--review-accent-purple)]/90 text-white"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4 mr-1" />
                        )}
                        Post
                    </Button>
                </div>
            </div>
            {/* Area Selection Overlay Portal */}
            {isSelectingArea && (videoRef?.current?.parentElement || imageRef?.current?.parentElement) && createPortal(
                <div
                    className="absolute inset-0 z-[100] cursor-crosshair bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
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
                            setIsSelectingArea(false);
                            setSelectionStart(null);
                        }}
                    >
                        Cancel
                    </button>
                </div>,
                (videoRef?.current?.parentElement || imageRef?.current?.parentElement)!
            )}
        </div>
    );
}