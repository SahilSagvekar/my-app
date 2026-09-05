'use client';

import { useMemo, useRef } from 'react';
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
}: ReviewCompactTransportProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const versionFilteredComments = useMemo(() => {
        return currentVersionNumber !== undefined
            ? comments.filter(c => c.version === undefined || c.version === currentVersionNumber)
            : comments;
    }, [comments, currentVersionNumber]);

    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    const getTimeFromClientX = (clientX: number) => {
        if (!trackRef.current || duration === 0) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return percentage * duration;
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

    return (
        <div className="review-compact-transport w-full min-w-0 py-1">
            <div
                    ref={trackRef}
                    className="review-compact-scrub relative h-4 flex items-center cursor-pointer group"
                    onMouseDown={handleMouseDown}
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={duration || 0}
                    aria-valuenow={currentTime}
                    aria-label="Seek"
            >
                <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/15 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-[var(--review-accent-purple)] transition-[width] duration-75 ease-linear"
                            style={{ width: `${progressPct}%` }}
                        />
                </div>

                {/* Comment markers */}
                {versionFilteredComments.map((comment) => {
                        if (duration <= 0) return null;
                        const left = (comment.timestampSeconds / duration) * 100;
                        const isActive = comment.id === activeCommentId;
                        return (
                            <button
                                key={comment.id}
                                type="button"
                                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full z-[2] transition-transform hover:scale-150 ${
                                    isActive
                                        ? 'bg-white ring-2 ring-[var(--review-accent-purple)]'
                                        : 'bg-[var(--review-accent-purple)]/90'
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

                {/* Playhead thumb */}
                <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-[3] pointer-events-none"
                        style={{ left: `${progressPct}%` }}
                />
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
