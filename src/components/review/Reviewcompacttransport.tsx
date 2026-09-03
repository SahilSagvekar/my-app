'use client';

import { useMemo, useRef } from 'react';
import { memo } from 'react';
import {
    Play, Pause, Volume2, VolumeX, Settings, Maximize2,
    FileCode2,
} from 'lucide-react';
import { Button } from '../ui/button';
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
    TooltipTrigger,
} from '../ui/tooltip';
import { ReviewComment } from './types';

interface ReviewCompactTransportProps {
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    isMuted: boolean;
    playbackSpeed: number;
    comments: ReviewComment[];
    activeCommentId?: string;
    currentVersionNumber?: number;
    /** Short code shown in the file-code badge (e.g. SF, MAIN, V2). */
    fileCode?: string;
    formatTime: (t: number) => string;
    onTogglePlay: () => void;
    onToggleMute: () => void;
    onSeek: (time: number) => void;
    onPlaybackSpeedChange: (speed: string) => void;
    onMarkerClick: (comment: ReviewComment) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    onExpand?: () => void;
}

export const ReviewCompactTransport = memo(function ReviewCompactTransport({
    duration,
    currentTime,
    isPlaying,
    isMuted,
    playbackSpeed,
    comments,
    activeCommentId,
    currentVersionNumber,
    fileCode,
    formatTime,
    onTogglePlay,
    onToggleMute,
    onSeek,
    onPlaybackSpeedChange,
    onMarkerClick,
    onDragStart,
    onDragEnd,
    onExpand,
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
        <div className="review-compact-transport flex items-center gap-2 w-full min-w-0">
            {/* Play */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onTogglePlay}
                        className="text-white hover:bg-white/10 h-8 w-8 p-0 shrink-0 rounded-full"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Play/Pause (Space)</TooltipContent>
            </Tooltip>

            {/* Mute */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleMute}
                        className="text-[var(--review-text-secondary)] hover:text-white hover:bg-white/10 h-8 w-8 p-0 shrink-0 rounded-full"
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Mute (M)</TooltipContent>
            </Tooltip>

            {/* Time */}
            <span className="text-[11px] text-white/90 font-mono tabular-nums shrink-0 whitespace-nowrap">
                {formatTime(currentTime)}
                <span className="text-white/40"> / {formatTime(duration)}</span>
            </span>

            {/* File-code badge */}
            {fileCode && (
                <span
                    className="review-file-code-badge inline-flex items-center gap-1 shrink-0 rounded-md border border-[var(--review-accent-purple)]/40 bg-[var(--review-accent-purple)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--review-accent-purple)]"
                    title="Deliverable / file code"
                >
                    <FileCode2 className="h-3 w-3" />
                    {fileCode}
                </span>
            )}

            {/* Thin purple scrub bar with markers */}
            <div className="flex-1 min-w-[80px] px-1">
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

            {/* Settings gear — playback speed */}
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--review-text-secondary)] hover:text-white hover:bg-white/10 h-8 w-8 p-0 shrink-0 rounded-full"
                                aria-label="Settings"
                            >
                                <Settings className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Playback settings</TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                    align="end"
                    className="bg-[var(--review-bg-elevated)] border-[var(--review-border)] text-white min-w-[140px]"
                >
                    <DropdownMenuLabel className="text-[var(--review-text-muted)] text-[10px] uppercase tracking-wider">
                        Speed
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[var(--review-border)]" />
                    {['0.5', '0.75', '1', '1.25', '1.5', '2'].map((s) => (
                        <DropdownMenuItem
                            key={s}
                            onClick={() => onPlaybackSpeedChange(s)}
                            className={`text-xs cursor-pointer focus:bg-white/10 focus:text-white ${
                                playbackSpeed.toString() === s ? 'text-[var(--review-accent-purple)]' : 'text-[var(--review-text-secondary)]'
                            }`}
                        >
                            {s}× {playbackSpeed.toString() === s ? '✓' : ''}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Expand */}
            {onExpand && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onExpand}
                            className="text-[var(--review-text-secondary)] hover:text-white hover:bg-white/10 h-8 w-8 p-0 shrink-0 rounded-full"
                            aria-label="Expand"
                        >
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Expand player</TooltipContent>
                </Tooltip>
            )}
        </div>
    );
});