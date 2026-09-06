'use client';

import { useEffect, useMemo, useRef } from 'react';
import { memo } from 'react';
import { Pause, Play, RotateCcw, RotateCw, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '../ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '../ui/tooltip';
import { ReviewComment } from './types';

const HANDLE_HIT_PX = 8;
const MIN_RANGE_SEC = 1;
const DEFAULT_RANGE_SEC = 3;

type RangeDragKind = 'create' | 'move' | 'resize-start' | 'resize-end';

interface ReviewCompactTransportProps {
    duration: number;
    currentTime: number;
    comments: ReviewComment[];
    activeCommentId?: string;
    currentVersionNumber?: number;
    onSeek: (time: number) => void;
    onMarkerClick: (comment: ReviewComment) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    /** Enters drag-select mode: dragging the track defines a time range instead of seeking. */
    rangeMode?: boolean;
    /** The in-progress range being composed, in seconds. Controlled by the parent. */
    activeRange?: { start: number; end: number } | null;
    /** Fired continuously while creating or adjusting the range via drag. */
    onRangeChange?: (start: number, end: number) => void;
}

interface ReviewPlaybackControlsProps {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    playbackSpeed: number;
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
    onPlaybackSpeedChange: (speed: string) => void;
}

export const ReviewCompactTransport = memo(function ReviewCompactTransport({
    duration,
    currentTime,
    comments,
    activeCommentId,
    currentVersionNumber,
    onSeek,
    onMarkerClick,
    onDragStart,
    onDragEnd,
    rangeMode = false,
    activeRange = null,
    onRangeChange,
}: ReviewCompactTransportProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const rangeDragRef = useRef<{ kind: RangeDragKind; anchorSec: number; moveOffsetSec: number; moveWidthSec: number } | null>(null);
    const activeRangeRef = useRef(activeRange);

    useEffect(() => {
        activeRangeRef.current = activeRange;
    }, [activeRange]);

    const versionFilteredComments = useMemo(() => {
        return currentVersionNumber !== undefined
            ? comments.filter(c => c.version === undefined || c.version === currentVersionNumber)
            : comments;
    }, [comments, currentVersionNumber]);

    const pointComments = useMemo(
        () => versionFilteredComments.filter(c => c.endTimestampSeconds == null && !c.isGeneral),
        [versionFilteredComments]
    );
    const rangeComments = useMemo(
        () => versionFilteredComments.filter(c => c.endTimestampSeconds != null && !c.isGeneral),
        [versionFilteredComments]
    );

    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    const getTimeFromClientX = (clientX: number) => {
        if (!trackRef.current || duration === 0) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return percentage * duration;
    };

    const secondsToClientX = (seconds: number, rect: DOMRect) => {
        const pct = duration > 0 ? seconds / duration : 0;
        return rect.left + pct * rect.width;
    };

    const handleSeekAt = (clientX: number) => {
        onSeek(getTimeFromClientX(clientX));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        onDragStart?.();
        handleSeekAt(e.clientX);

        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            handleSeekAt(ev.clientX);
        };
        const handleMouseUp = () => {
            isDragging.current = false;
            onDragEnd?.();
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleRangeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!trackRef.current || duration <= 0) return;
        const rect = trackRef.current.getBoundingClientRect();
        const clickSec = getTimeFromClientX(e.clientX);
        const current = activeRangeRef.current;

        let kind: RangeDragKind = 'create';
        let moveOffsetSec = 0;
        let moveWidthSec = 0;

        if (current) {
            const startPx = secondsToClientX(current.start, rect);
            const endPx = secondsToClientX(current.end, rect);
            if (Math.abs(e.clientX - startPx) <= HANDLE_HIT_PX) {
                kind = 'resize-start';
            } else if (Math.abs(e.clientX - endPx) <= HANDLE_HIT_PX) {
                kind = 'resize-end';
            } else if (e.clientX > startPx && e.clientX < endPx) {
                kind = 'move';
                moveOffsetSec = clickSec - current.start;
                moveWidthSec = current.end - current.start;
            }
        }

        rangeDragRef.current = { kind, anchorSec: clickSec, moveOffsetSec, moveWidthSec };
        onDragStart?.();

        if (kind === 'create') {
            onRangeChange?.(clickSec, clickSec);
        }

        const handleMove = (ev: MouseEvent) => {
            const drag = rangeDragRef.current;
            if (!drag) return;
            const movedSec = getTimeFromClientX(ev.clientX);
            switch (drag.kind) {
                case 'create': {
                    const start = Math.min(drag.anchorSec, movedSec);
                    const end = Math.max(drag.anchorSec, movedSec);
                    onRangeChange?.(start, end);
                    break;
                }
                case 'resize-start': {
                    const cur = activeRangeRef.current;
                    if (!cur) break;
                    const start = Math.max(0, Math.min(movedSec, cur.end - MIN_RANGE_SEC));
                    onRangeChange?.(start, cur.end);
                    break;
                }
                case 'resize-end': {
                    const cur = activeRangeRef.current;
                    if (!cur) break;
                    const end = Math.min(duration, Math.max(movedSec, cur.start + MIN_RANGE_SEC));
                    onRangeChange?.(cur.start, end);
                    break;
                }
                case 'move': {
                    const width = drag.moveWidthSec;
                    let start = movedSec - drag.moveOffsetSec;
                    start = Math.max(0, Math.min(start, duration - width));
                    onRangeChange?.(start, start + width);
                    break;
                }
            }
        };

        const handleUp = () => {
            const drag = rangeDragRef.current;
            if (drag?.kind === 'create') {
                const cur = activeRangeRef.current;
                if (cur && cur.end - cur.start < MIN_RANGE_SEC) {
                    const start = cur.start;
                    const end = Math.min(duration, start + DEFAULT_RANGE_SEC);
                    onRangeChange?.(start, end);
                }
            }
            rangeDragRef.current = null;
            onDragEnd?.();
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    return (
        <div className="review-compact-transport w-full min-w-0 py-0 px-8">
            <div
                    ref={trackRef}
                    className={`review-compact-scrub relative h-4 flex items-center group ${rangeMode ? 'cursor-crosshair' : 'cursor-pointer'}`}
                    onMouseDown={rangeMode ? handleRangeMouseDown : handleMouseDown}
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={duration || 0}
                    aria-valuenow={currentTime}
                    aria-label={rangeMode ? 'Select comment range' : 'Seek'}
            >
                <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/15 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-[var(--review-accent-purple)] transition-[width] duration-75 ease-linear"
                            style={{ width: `${progressPct}%` }}
                        />
                </div>

                {/* Existing range comments — shown as a band spanning start–end */}
                {rangeComments.map((comment) => {
                        if (duration <= 0 || comment.endTimestampSeconds == null) return null;
                        const startPct = (comment.timestampSeconds / duration) * 100;
                        const endPct = (comment.endTimestampSeconds / duration) * 100;
                        const isActive = comment.id === activeCommentId;
                        return (
                            <button
                                key={comment.id}
                                type="button"
                                className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-sm z-[1] transition-colors ${
                                    isActive ? 'bg-white/40' : 'bg-white/20 hover:bg-white/30'
                                }`}
                                style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.5)}%` }}
                                title={`${comment.timestamp}–${comment.endTimestamp}: ${comment.content.slice(0, 60)}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkerClick(comment);
                                }}
                            />
                        );
                })}

                {/* Single-timestamp comment markers */}
                {pointComments.map((comment) => {
                        if (duration <= 0) return null;
                        const left = (comment.timestampSeconds / duration) * 100;
                        const isActive = comment.id === activeCommentId;
                        return (
                            <button
                                key={comment.id}
                                type="button"
                                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] rounded-none z-[2] transition-all hover:h-4 ${
                                    isActive
                                        ? 'h-4 bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]'
                                        : 'h-3 bg-white/80'
                                }`}
                                style={{ left: `${left}%` }}
                                title={`${comment.timestamp}: ${comment.content.slice(0, 60)}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkerClick(comment);
                                }}
                            />
                        );
                })}

                {/* In-progress range being composed via drag-select */}
                {rangeMode && activeRange && duration > 0 && (
                    <>
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-[6px] rounded-sm bg-[var(--review-accent-purple)]/50 pointer-events-none z-[2]"
                            style={{
                                left: `${(activeRange.start / duration) * 100}%`,
                                width: `${Math.max(((activeRange.end - activeRange.start) / duration) * 100, 0.3)}%`,
                            }}
                        />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[var(--review-accent-purple)] shadow-md pointer-events-none z-[3]"
                            style={{ left: `${(activeRange.start / duration) * 100}%` }}
                        />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[var(--review-accent-purple)] shadow-md pointer-events-none z-[3]"
                            style={{ left: `${(activeRange.end / duration) * 100}%` }}
                        />
                    </>
                )}

                {/* Playhead thumb */}
                {!rangeMode && (
                    <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-[3] pointer-events-none"
                            style={{ left: `${progressPct}%` }}
                    />
                )}
            </div>
        </div>
    );
});

/** Controls placed immediately to the left of the centered review actions. */
export function ReviewPlaybackControls({ currentTime, duration, isPlaying, playbackSpeed, onTogglePlay, onSeek, onPlaybackSpeedChange }: ReviewPlaybackControlsProps) {
    const seekBy = (seconds: number) => onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));

    return (
        <div className="flex items-center gap-1.5" aria-label="Playback controls">
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => seekBy(-15)} className="h-8 w-8 rounded-full p-0 text-[var(--review-text-secondary)] hover:bg-white/10 hover:text-white" aria-label="Back 15 seconds"><RotateCcw className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Back 15 seconds</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={onTogglePlay} className="h-8 w-8 rounded-full p-0 text-white hover:bg-white/10" aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}</Button></TooltipTrigger><TooltipContent>Play/Pause</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => seekBy(15)} className="h-8 w-8 rounded-full p-0 text-[var(--review-text-secondary)] hover:bg-white/10 hover:text-white" aria-label="Forward 15 seconds"><RotateCw className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Forward 15 seconds</TooltipContent></Tooltip>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-2 text-xs text-[var(--review-text-secondary)] hover:bg-white/10 hover:text-white" aria-label="Playback speed">{playbackSpeed}×<ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-[104px] border-[var(--review-border)] bg-[var(--review-bg-elevated)] text-white">{['0.5', '0.75', '1', '1.25', '1.5', '2'].map((speed) => <DropdownMenuItem key={speed} onClick={() => onPlaybackSpeedChange(speed)} className="cursor-pointer text-xs focus:bg-white/10 focus:text-white">{speed}× {playbackSpeed.toString() === speed ? '✓' : ''}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        </div>
    );
}