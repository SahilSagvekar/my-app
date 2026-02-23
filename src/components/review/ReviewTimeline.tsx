'use client';

import { useRef, useEffect, useMemo, memo } from 'react';
import { ReviewComment } from './types';

interface ReviewTimelineProps {
    duration: number;
    currentTime: number;
    comments: ReviewComment[];
    activeCommentId?: string;
    onSeek: (time: number) => void;
    onMarkerClick: (comment: ReviewComment) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}

export const ReviewTimeline = memo(function ReviewTimeline({
    duration,
    currentTime,
    comments,
    activeCommentId,
    onSeek,
    onMarkerClick,
    onDragStart,
    onDragEnd,
}: ReviewTimelineProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getPositionFromTime = (time: number) => {
        if (duration === 0) return 0;
        return (time / duration) * 100;
    };

    const getTimeFromPosition = (clientX: number) => {
        if (!trackRef.current || duration === 0) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return percentage * duration;
    };

    const handleTrackClick = (e: React.MouseEvent) => {
        const newTime = getTimeFromPosition(e.clientX);
        onSeek(newTime);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        onDragStart?.();
        handleTrackClick(e);

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const newTime = getTimeFromPosition(e.clientX);
            onSeek(newTime);
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

    // Group comments that are very close together
    const markerGroups = useMemo(() => {
        const threshold = duration * 0.02; // 2% of duration
        const groups: { time: number; comments: ReviewComment[] }[] = [];

        comments.forEach((comment) => {
            const existingGroup = groups.find(
                (g) => Math.abs(g.time - comment.timestampSeconds) < threshold
            );
            if (existingGroup) {
                existingGroup.comments.push(comment);
            } else {
                groups.push({ time: comment.timestampSeconds, comments: [comment] });
            }
        });

        return groups;
    }, [comments, duration]);

    return (
        <div className="review-timeline !rounded-full" style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="relative flex-1 h-2 flex items-center">
                {/* Time Display at the top */}
                <div className="flex justify-between w-full absolute -top-5 left-0 pointer-events-none">
                    <span className="text-[10px] text-[var(--review-text-muted)] font-mono">{formatTime(currentTime)}</span>
                    <span className="text-[10px] text-[var(--review-text-muted)] font-mono">{formatTime(duration)}</span>
                </div>

                {/* Comment Markers */}
                {markerGroups.map((group: { time: number; comments: ReviewComment[] }, index: number) => (
                    <div
                        key={index}
                        className={`review-timeline-marker ${group.comments.some((c: ReviewComment) => c.id === activeCommentId) ? 'active' : ''
                            }`}
                        style={{ left: `${getPositionFromTime(group.time)}%` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkerClick(group.comments[0]);
                        }}
                        title={`${group.comments.length} comment${group.comments.length > 1 ? 's' : ''} at ${formatTime(group.time)}`}
                    >
                        {group.comments.length > 1 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-white text-[var(--review-accent-purple)] text-[8px] font-bold rounded-full flex items-center justify-center">
                                {group.comments.length}
                            </span>
                        )}
                    </div>
                ))}

                {/* Track */}
                <div
                    ref={trackRef}
                    className="review-timeline-track !left-0 !right-0 !rounded-full"
                    onClick={handleTrackClick}
                    onMouseDown={handleMouseDown}
                >
                    {/* Progress - Uses percentage for width */}
                    <div
                        className="review-timeline-progress !rounded-full"
                        style={{ width: `${getPositionFromTime(currentTime)}%` }}
                    />
                </div>

                {/* Playhead */}
                <div
                    className="review-timeline-playhead"
                    style={{
                        left: `${getPositionFromTime(currentTime)}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                    onMouseDown={handleMouseDown}
                />
            </div>
        </div>
    );
});
