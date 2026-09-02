'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eraser, Undo2, X } from 'lucide-react';
import { Button } from '../ui/button';

interface ReviewDrawOverlayProps {
    /** Base captured frame (data URL). Drawn under the annotation strokes. */
    baseImageUrl: string;
    /** Element whose box the overlay should cover (video/image parent). */
    container: HTMLElement;
    onComplete: (composedDataUrl: string) => void;
    onCancel: () => void;
}

const STROKE_COLOR = '#a78bfa';
const STROKE_WIDTH = 3;

/**
 * Transparent freehand drawing canvas over the current video frame.
 * On Done, composites strokes onto the captured frame and returns a JPEG data URL.
 */
export function ReviewDrawOverlay({
    baseImageUrl,
    container,
    onComplete,
    onCancel,
}: ReviewDrawOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const strokesRef = useRef<{ x: number; y: number }[][]>([]);
    const [strokeCount, setStrokeCount] = useState(0);

    const syncCanvasSize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = STROKE_COLOR;
            ctx.lineWidth = STROKE_WIDTH;
            // Redraw existing strokes after resize
            redraw(ctx);
        }
    }, [container]);

    const redraw = (ctx: CanvasRenderingContext2D) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const stroke of strokesRef.current) {
            if (stroke.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            ctx.stroke();
        }
    };

    useEffect(() => {
        syncCanvasSize();
        const ro = new ResizeObserver(() => syncCanvasSize());
        ro.observe(container);
        window.addEventListener('resize', syncCanvasSize);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', syncCanvasSize);
        };
    }, [container, syncCanvasSize]);

    const getPoint = (e: React.PointerEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        drawing.current = true;
        const pt = getPoint(e);
        strokesRef.current.push([pt]);
        setStrokeCount(strokesRef.current.length);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!drawing.current) return;
        const pt = getPoint(e);
        const current = strokesRef.current[strokesRef.current.length - 1];
        current?.push(pt);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && current && current.length >= 2) {
            const prev = current[current.length - 2];
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
        }
    };

    const handlePointerUp = () => {
        drawing.current = false;
    };

    const handleUndo = () => {
        strokesRef.current.pop();
        setStrokeCount(strokesRef.current.length);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) redraw(ctx);
    };

    const handleClear = () => {
        strokesRef.current = [];
        setStrokeCount(0);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    const handleDone = async () => {
        const overlay = canvasRef.current;
        if (!overlay) return;

        try {
            const base = await loadImage(baseImageUrl);
            const out = document.createElement('canvas');
            // Output at base image resolution
            out.width = base.naturalWidth || base.width;
            out.height = base.naturalHeight || base.height;
            const ctx = out.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(base, 0, 0, out.width, out.height);

            // Scale overlay strokes into base image space
            const scaleX = out.width / (overlay.clientWidth || 1);
            const scaleY = out.height / (overlay.clientHeight || 1);
            ctx.strokeStyle = STROKE_COLOR;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(2, STROKE_WIDTH * ((scaleX + scaleY) / 2));

            for (const stroke of strokesRef.current) {
                if (stroke.length < 2) continue;
                ctx.beginPath();
                ctx.moveTo(stroke[0].x * scaleX, stroke[0].y * scaleY);
                for (let i = 1; i < stroke.length; i++) {
                    ctx.lineTo(stroke[i].x * scaleX, stroke[i].y * scaleY);
                }
                ctx.stroke();
            }

            onComplete(out.toDataURL('image/jpeg', 0.85));
        } catch (err) {
            console.error('Failed to compose drawing:', err);
            // Fall back to base frame without strokes
            onComplete(baseImageUrl);
        }
    };

    return (
        <div className="absolute inset-0 z-[110] flex flex-col">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/75 border border-white/15 px-2 py-1.5 backdrop-blur-sm shadow-lg">
                <span className="text-[10px] uppercase tracking-wider text-white/70 px-2 font-semibold">
                    Draw on frame
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={strokeCount === 0}
                    className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30"
                    title="Undo"
                >
                    <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={strokeCount === 0}
                    className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30"
                    title="Clear"
                >
                    <Eraser className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-0.5" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    className="h-7 gap-1 px-2 text-red-300 hover:text-red-200 hover:bg-red-500/20"
                >
                    <X className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-semibold">Cancel</span>
                </Button>
                <Button
                    size="sm"
                    onClick={handleDone}
                    className="h-7 gap-1 px-2.5 bg-[var(--review-accent-purple)] hover:bg-[var(--review-accent-purple)]/90 text-white"
                >
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-semibold">Done</span>
                </Button>
            </div>
        </div>
    );
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
