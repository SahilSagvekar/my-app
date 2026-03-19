'use client';

import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ReviewComment, COMMENT_CATEGORIES, CommentCategory } from './types';
import { Plus, Send, X, AtSign, Camera, Crop, Clock } from 'lucide-react';

import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

const MAX_SCREENSHOT_WIDTH = 1280;
const MAX_SCREENSHOT_HEIGHT = 720;

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

interface CommentInputProps {
    taskId: string;
    currentTime: number;
    currentTimestamp: string;
    authorId: string;
    authorName: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    duration?: number; // Video duration for validation


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
    duration = 0,
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

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Validate end timestamp when it changes
    useEffect(() => {
        if (!useEndTimestamp || !endTimestampInput) {
            setEndTimestampError(null);
            return;
        }
        
        const endSeconds = parseTimestampToSeconds(endTimestampInput);
        if (endSeconds === null) {
            setEndTimestampError('Invalid format (use M:SS)');
        } else if (endSeconds <= currentTime) {
            setEndTimestampError('Must be after start time');
        } else if (duration > 0 && endSeconds > duration) {
            setEndTimestampError('Exceeds video length');
        } else {
            setEndTimestampError(null);
        }
    }, [endTimestampInput, useEndTimestamp, currentTime, duration]);

    useEffect(() => {
        if (isExpanded && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isExpanded]);

    const captureArea = (video: HTMLVideoElement, area?: { x: number, y: number, w: number, h: number }) => {
        const canvas = document.createElement('canvas');

        // Use intrinsic video dimensions
        const sourceW = video.videoWidth || video.clientWidth;
        const sourceH = video.videoHeight || video.clientHeight;
        const displayW = video.clientWidth;
        const displayH = video.clientHeight;

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
            video,
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
        } catch (err) {
            console.error('Failed to capture screenshot:', err);
        }
    };

    const handleCapture = () => {
        const video = videoRef?.current;
        if (!video) return;

        // Defer heavy canvas work off the exact playback tick
        window.requestAnimationFrame(() => {
            captureArea(video);
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
        if (!selectionRect || !videoRef?.current) {
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

        const video = videoRef.current;
        // Defer heavy canvas work off the exact playback tick
        window.requestAnimationFrame(() => {
            captureArea(video, selectionRect);
        });
        setIsSelectingArea(false);
        setSelectionStart(null);
    };


    const handleSubmit = async () => {
        if (!content.trim()) return;
        
        // Validate end timestamp if enabled
        if (useEndTimestamp && endTimestampInput) {
            const endSeconds = parseTimestampToSeconds(endTimestampInput);
            if (endSeconds === null || endSeconds <= currentTime) {
                return; // Don't submit with invalid end timestamp
            }
        }

        setIsSubmitting(true);
        
        // Build end timestamp data if enabled and valid
        const endSeconds = useEndTimestamp && endTimestampInput 
            ? parseTimestampToSeconds(endTimestampInput) 
            : undefined;

        const newComment: Omit<ReviewComment, 'id' | 'createdAt'> = {
            taskId,
            authorId,
            authorName,
            timestamp: currentTimestamp,
            timestampSeconds: currentTime,
            endTimestamp: endSeconds ? endTimestampInput : undefined,
            endTimestampSeconds: endSeconds ?? undefined,
            content: content.trim(),
            category,
            screenshotUrl: screenshotUrl || undefined,
            resolved: false,
            replies: [],
        };


        await onSubmit(newComment);
        setContent('');
        setScreenshotUrl(null);
        setUseEndTimestamp(false);
        setEndTimestampInput('');
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
                            {currentTimestamp}
                        </span>
                        {useEndTimestamp && (
                            <>
                                <span className="text-[var(--review-text-muted)]">–</span>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        value={endTimestampInput}
                                        onChange={(e) => setEndTimestampInput(e.target.value)}
                                        placeholder="M:SS"
                                        className={`w-16 h-6 px-1.5 text-xs bg-[var(--review-bg-elevated)] border rounded text-center font-mono ${
                                            endTimestampError 
                                                ? 'border-red-500 text-red-400' 
                                                : 'border-[var(--review-border)] text-white'
                                        }`}
                                    />
                                    {endTimestampError && (
                                        <div className="absolute top-full left-0 mt-1 text-[10px] text-red-400 whitespace-nowrap">
                                            {endTimestampError}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setUseEndTimestamp(false);
                                        setEndTimestampInput('');
                                    }}
                                    className="h-5 w-5 p-0 text-[var(--review-text-muted)] hover:text-red-400"
                                    title="Remove end time"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                        {!useEndTimestamp && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setUseEndTimestamp(true);
                                    // Pre-fill with current time + 10 seconds as suggestion
                                    const suggestedEnd = Math.min(currentTime + 10, duration || currentTime + 30);
                                    setEndTimestampInput(formatSecondsToTimestamp(suggestedEnd));
                                }}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title="Add end time for a range (e.g., 1:00 - 1:28)"
                            >
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Range</span>
                            </Button>
                        )}
                    </div>
                    {videoRef && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCapture}
                                className="h-6 gap-1 px-2 text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)] hover:bg-[var(--review-bg-elevated)]"
                                title="Capture full frame"
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
                        </div>
                    )}
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
                        <Send className="h-4 w-4 mr-1" />
                        Post
                    </Button>
                </div>
            </div>
            {/* Area Selection Overlay Portal */}
            {isSelectingArea && videoRef?.current?.parentElement && createPortal(
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
                videoRef.current.parentElement
            )}
        </div>
    );
}
