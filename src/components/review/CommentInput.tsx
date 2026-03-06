'use client';

import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ReviewComment, COMMENT_CATEGORIES, CommentCategory } from './types';
import { Plus, Send, X, AtSign, Camera, Crop } from 'lucide-react';

import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface CommentInputProps {
    taskId: string;
    currentTime: number;
    currentTimestamp: string;
    authorId: string;
    authorName: string;
    videoRef?: React.RefObject<HTMLVideoElement | null>;


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

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isExpanded && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isExpanded]);

    const handleCapture = () => {
        const video = videoRef?.current;
        if (!video) return;

        captureArea(video);
    };

    const captureArea = (video: HTMLVideoElement, area?: { x: number, y: number, w: number, h: number }) => {
        const canvas = document.createElement('canvas');

        // Use intrinsic video dimensions
        const sourceW = video.videoWidth;
        const sourceH = video.videoHeight;
        const displayW = video.clientWidth;
        const displayH = video.clientHeight;

        if (area && area.w > 5 && area.h > 5) {
            // Convert display coordinates to source coordinates
            const scaleX = sourceW / displayW;
            const scaleY = sourceH / displayH;

            canvas.width = area.w * scaleX;
            canvas.height = area.h * scaleY;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(
                video,
                area.x * scaleX, area.y * scaleY, area.w * scaleX, area.h * scaleY,
                0, 0, canvas.width, canvas.height
            );
        } else {
            canvas.width = sourceW;
            canvas.height = sourceH;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setScreenshotUrl(dataUrl);
        } catch (err) {
            console.error('Failed to capture screenshot:', err);
        }
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

        captureArea(videoRef.current, selectionRect);
        setIsSelectingArea(false);
        setSelectionStart(null);
    };


    const handleSubmit = async () => {
        if (!content.trim()) return;

        setIsSubmitting(true);

        const newComment: Omit<ReviewComment, 'id' | 'createdAt'> = {
            taskId,
            authorId,
            authorName,
            timestamp: currentTimestamp,
            timestampSeconds: currentTime,
            content: content.trim(),
            category,
            screenshotUrl: screenshotUrl || undefined,
            resolved: false,
            replies: [],
        };


        await onSubmit(newComment);
        setContent('');
        setScreenshotUrl(null);
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
                    <span className="review-comment-timestamp flex items-center gap-1">
                        {currentTimestamp}
                    </span>
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
