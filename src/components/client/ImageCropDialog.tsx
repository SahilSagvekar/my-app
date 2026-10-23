'use client';

// Simple image crop / aspect-ratio editor for the hard post / picture review.
// Runs entirely in the browser on a canvas — no library. The reviewer drags or
// resizes a crop box (or picks an aspect ratio preset) and hits Apply; the
// cropped image is handed to `onSave` as a Blob, which the review screen
// uploads as a new version of that image (see /api/tasks/[id]/files/[fileId]/crop).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';

interface ImageCropDialogProps {
    open: boolean;
    onClose: () => void;
    imageUrl: string;
    fileName: string;
    mimeType?: string;
    saving: boolean;
    onSave: (blob: Blob) => void | Promise<void>;
}

type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const MIN_SIZE = 24; // natural px

const PRESETS: { key: string; label: string; ratio: number | 'original' | null }[] = [
    { key: 'free', label: 'Free', ratio: null },
    { key: 'original', label: 'Original', ratio: 'original' },
    { key: '1:1', label: '1:1', ratio: 1 },
    { key: '4:5', label: '4:5', ratio: 4 / 5 },
    { key: '5:4', label: '5:4', ratio: 5 / 4 },
    { key: '3:2', label: '3:2', ratio: 3 / 2 },
    { key: '2:3', label: '2:3', ratio: 2 / 3 },
    { key: '16:9', label: '16:9', ratio: 16 / 9 },
    { key: '9:16', label: '9:16', ratio: 9 / 16 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Biggest rect of the given ratio that fits the image, centred on it. */
function fitRatio(nat: { w: number; h: number }, ratio: number): Rect {
    let w = nat.w;
    let h = w / ratio;
    if (h > nat.h) {
        h = nat.h;
        w = h * ratio;
    }
    return { x: (nat.w - w) / 2, y: (nat.h - h) / 2, w, h };
}

/** New crop rect for a pointer drag (all coordinates in natural image px). */
function applyDrag(
    handle: Handle,
    start: Rect,
    dx: number,
    dy: number,
    ratio: number | null,
    nat: { w: number; h: number },
): Rect {
    if (handle === 'move') {
        return {
            ...start,
            x: clamp(start.x + dx, 0, nat.w - start.w),
            y: clamp(start.y + dy, 0, nat.h - start.h),
        };
    }

    const hasW = handle.includes('w');
    const hasE = handle.includes('e');
    const hasN = handle.includes('n');
    const hasS = handle.includes('s');
    const isCorner = (hasW || hasE) && (hasN || hasS);

    if (isCorner) {
        // The corner opposite the dragged one stays fixed.
        const ax = hasW ? start.x + start.w : start.x;
        const ay = hasN ? start.y + start.h : start.y;
        const cx = (hasW ? start.x : start.x + start.w) + dx;
        const cy = (hasN ? start.y : start.y + start.h) + dy;
        const maxW = hasW ? ax : nat.w - ax;
        const maxH = hasN ? ay : nat.h - ay;

        let w = Math.abs(cx - ax);
        let h = Math.abs(cy - ay);

        if (ratio) {
            // Follow whichever axis the pointer moved further along.
            if (w / ratio >= h) h = w / ratio;
            else w = h * ratio;
            const f = Math.min(1, maxW / w, maxH / h);
            w *= f;
            h *= f;
            if (w < MIN_SIZE) { w = MIN_SIZE; h = w / ratio; }
            if (h < MIN_SIZE) { h = MIN_SIZE; w = h * ratio; }
        } else {
            w = clamp(w, MIN_SIZE, maxW);
            h = clamp(h, MIN_SIZE, maxH);
        }
        return { x: hasW ? ax - w : ax, y: hasN ? ay - h : ay, w, h };
    }

    // Edge handles (only offered while the aspect ratio is free).
    let left = start.x;
    let right = start.x + start.w;
    let top = start.y;
    let bottom = start.y + start.h;
    if (hasW) left = clamp(left + dx, 0, right - MIN_SIZE);
    if (hasE) right = clamp(right + dx, left + MIN_SIZE, nat.w);
    if (hasN) top = clamp(top + dy, 0, bottom - MIN_SIZE);
    if (hasS) bottom = clamp(bottom + dy, top + MIN_SIZE, nat.h);
    return { x: left, y: top, w: right - left, h: bottom - top };
}

const HANDLE_STYLE: Record<Exclude<Handle, 'move'>, { cls: string; cursor: string }> = {
    nw: { cls: '-top-1.5 -left-1.5', cursor: 'nwse-resize' },
    n: { cls: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
    ne: { cls: '-top-1.5 -right-1.5', cursor: 'nesw-resize' },
    e: { cls: 'top-1/2 -right-1.5 -translate-y-1/2', cursor: 'ew-resize' },
    se: { cls: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize' },
    s: { cls: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
    sw: { cls: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize' },
    w: { cls: 'top-1/2 -left-1.5 -translate-y-1/2', cursor: 'ew-resize' },
};

export function ImageCropDialog({
    open,
    onClose,
    imageUrl,
    fileName,
    mimeType,
    saving,
    onSave,
}: ImageCropDialogProps) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ handle: Handle; startX: number; startY: number; start: Rect } | null>(null);

    const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [crop, setCrop] = useState<Rect | null>(null);
    const [presetKey, setPresetKey] = useState('free');
    const [maxDisp, setMaxDisp] = useState({ w: 800, h: 480 });

    const ratio = useMemo(() => {
        const p = PRESETS.find(x => x.key === presetKey);
        if (!p || p.ratio === null) return null;
        if (p.ratio === 'original') return nat ? nat.w / nat.h : null;
        return p.ratio;
    }, [presetKey, nat]);

    // Load the image fresh with CORS enabled so the canvas isn't tainted.
    useEffect(() => {
        if (!open) return;
        setNat(null);
        setCrop(null);
        setLoadError(null);
        setPresetKey('free');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            imgRef.current = img;
            const size = { w: img.naturalWidth, h: img.naturalHeight };
            setNat(size);
            setCrop({ x: 0, y: 0, w: size.w, h: size.h });
        };
        img.onerror = () => {
            setLoadError(
                "This image can't be opened for editing in the browser (the storage server blocked it). Ask for the storage CORS setting to be checked.",
            );
        };
        img.src = imageUrl;
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [open, imageUrl]);

    // Fit the preview to the space the dialog gives it.
    useEffect(() => {
        if (!open) return;
        const update = () => {
            const w = Math.min(window.innerWidth - 96, 920);
            const h = Math.max(240, window.innerHeight - 300);
            setMaxDisp({ w, h });
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [open]);

    const scale = nat ? Math.min(maxDisp.w / nat.w, maxDisp.h / nat.h, 1) : 1;
    const dispW = nat ? nat.w * scale : 0;
    const dispH = nat ? nat.h * scale : 0;

    const selectPreset = (key: string) => {
        if (!nat) return;
        setPresetKey(key);
        const p = PRESETS.find(x => x.key === key)!;
        if (p.ratio === null) return; // Free: keep the current box
        const r = p.ratio === 'original' ? nat.w / nat.h : p.ratio;
        setCrop(fitRatio(nat, r));
    };

    const reset = () => {
        if (!nat) return;
        setPresetKey('free');
        setCrop({ x: 0, y: 0, w: nat.w, h: nat.h });
    };

    const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
        if (!crop) return;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { handle, startX: e.clientX, startY: e.clientY, start: crop };
    };

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            const d = dragRef.current;
            if (!d || !nat) return;
            const dx = (e.clientX - d.startX) / scale;
            const dy = (e.clientY - d.startY) / scale;
            setCrop(applyDrag(d.handle, d.start, dx, dy, ratio, nat));
        },
        [nat, scale, ratio],
    );

    const onPointerUp = () => {
        dragRef.current = null;
    };

    const isUnchanged =
        !!nat && !!crop &&
        Math.round(crop.x) === 0 && Math.round(crop.y) === 0 &&
        Math.round(crop.w) === nat.w && Math.round(crop.h) === nat.h;

    const handleApply = async () => {
        const img = imgRef.current;
        if (!img || !crop || !nat) return;
        const sx = Math.round(crop.x);
        const sy = Math.round(crop.y);
        const sw = Math.max(1, Math.min(Math.round(crop.w), nat.w - sx));
        const sh = Math.max(1, Math.min(Math.round(crop.h), nat.h - sy));

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            toast.error('Could not prepare the image for cropping');
            return;
        }
        // Keep PNG/WebP as they were; everything else saves as high-quality JPEG.
        const outType = mimeType === 'image/png' ? 'image/png' : mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
        if (outType === 'image/jpeg') {
            ctx.fillStyle = '#ffffff'; // no transparency in JPEG
            ctx.fillRect(0, 0, sw, sh);
        }
        try {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, outType, 0.92));
            if (!blob) throw new Error('Could not create the cropped image');
            await onSave(blob);
        } catch (err: any) {
            console.error('[ImageCropDialog] crop failed:', err);
            toast.error(
                err?.name === 'SecurityError'
                    ? "This image can't be read for editing (storage CORS). Try again or ask for it to be checked."
                    : err?.message || 'Failed to crop image',
            );
        }
    };

    const showEdgeHandles = ratio === null;
    const handles = (Object.keys(HANDLE_STYLE) as Exclude<Handle, 'move'>[]).filter(h =>
        showEdgeHandles ? true : h.length === 2,
    );

    return (
        <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
            <DialogContent
                className="!max-w-fit !w-auto !p-0 !gap-0 overflow-hidden border-[var(--review-border)] !z-[70]"
                style={{ background: 'var(--review-bg-secondary)' }}
            >
                <DialogTitle className="sr-only">Crop image</DialogTitle>
                <DialogDescription className="sr-only">
                    Drag the box or pick an aspect ratio, then apply to save a cropped version of {fileName}.
                </DialogDescription>

                <div className="px-5 pt-4 pb-3 border-b border-[var(--review-border)]">
                    <h3 className="text-sm font-semibold text-white">Crop &amp; aspect ratio</h3>
                    <p className="text-xs text-[var(--review-text-muted)] mt-0.5 truncate max-w-[560px]">
                        {fileName} — saved as a new version; the original is kept in the version history.
                    </p>
                </div>

                <div className="px-5 py-4 flex flex-col gap-3 items-center" style={{ minWidth: Math.min(maxDisp.w, 480) }}>
                    <div className="flex flex-wrap items-center gap-1.5 w-full justify-center">
                        {PRESETS.map(p => (
                            <button
                                key={p.key}
                                type="button"
                                disabled={!nat || saving}
                                onClick={() => selectPreset(p.key)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40"
                                style={presetKey === p.key
                                    ? { background: 'var(--review-v2-gray-50)', borderColor: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }
                                    : { background: 'transparent', borderColor: 'var(--review-border)', color: 'var(--review-v2-gray-100)' }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div
                        ref={boxRef}
                        className="relative bg-black rounded-sm select-none flex items-center justify-center"
                        style={{ width: Math.max(dispW, 240), height: Math.max(dispH, 160), touchAction: 'none' }}
                    >
                        {loadError ? (
                            <p className="text-xs text-red-300 max-w-sm text-center px-4">{loadError}</p>
                        ) : !nat || !crop ? (
                            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                        ) : (
                            <div className="relative" style={{ width: dispW, height: dispH }}>
                                <img
                                    src={imageUrl}
                                    crossOrigin="anonymous"
                                    alt={fileName}
                                    draggable={false}
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                />
                                {/* Dimmed area outside the crop box (box-shadow trick) */}
                                <div
                                    className="absolute border border-white cursor-move"
                                    style={{
                                        left: crop.x * scale,
                                        top: crop.y * scale,
                                        width: crop.w * scale,
                                        height: crop.h * scale,
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                                        touchAction: 'none',
                                    }}
                                    onPointerDown={onPointerDown('move')}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={onPointerUp}
                                >
                                    {/* Rule-of-thirds guides */}
                                    <div className="absolute inset-0 pointer-events-none opacity-40">
                                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
                                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
                                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
                                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
                                    </div>
                                    {handles.map(h => (
                                        <div
                                            key={h}
                                            className={`absolute w-3 h-3 bg-white border border-black/60 rounded-sm ${HANDLE_STYLE[h].cls}`}
                                            style={{ cursor: HANDLE_STYLE[h].cursor, touchAction: 'none' }}
                                            onPointerDown={onPointerDown(h)}
                                            onPointerMove={onPointerMove}
                                            onPointerUp={onPointerUp}
                                            onPointerCancel={onPointerUp}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-[var(--review-text-muted)] tabular-nums h-4">
                        {crop && nat
                            ? `${Math.round(crop.w)} × ${Math.round(crop.h)} px  (original ${nat.w} × ${nat.h})`
                            : ''}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-[var(--review-border)] flex items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                        disabled={!nat || saving || isUnchanged}
                        className="text-[var(--review-v2-gray-100)] hover:bg-white/10 gap-1.5"
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            disabled={saving}
                            className="text-[var(--review-v2-gray-100)] hover:bg-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleApply}
                            disabled={!nat || !crop || saving || isUnchanged}
                            className="bg-white text-black hover:bg-white/90 font-semibold gap-1.5"
                            title={isUnchanged ? 'Move or resize the box first' : undefined}
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {saving ? 'Saving…' : 'Apply crop'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
