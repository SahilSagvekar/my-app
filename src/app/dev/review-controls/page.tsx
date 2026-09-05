'use client';

/**
 * Local visual harness for the desktop review compact controls.
 * Not linked from production navigation — open /dev/review-controls directly.
 */
import { useMemo, useState } from 'react';
import {
    ReviewCompactTransport,
    ReviewModePills,
    type ReviewMode,
} from '@/components/review';
import type { ReviewComment } from '@/components/review/types';
import { TooltipProvider } from '@/components/ui/tooltip';

function formatTime(t: number) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const MOCK_COMMENTS: ReviewComment[] = [
    {
        id: '1',
        taskId: 'demo',
        authorId: 'u1',
        authorName: 'Sahil',
        timestamp: '0:12',
        timestampSeconds: 12,
        content: 'Trim this beat',
        category: ['timing'],
        resolved: false,
        createdAt: new Date(),
        version: 1,
    },
    {
        id: '2',
        taskId: 'demo',
        authorId: 'u1',
        authorName: 'Sahil',
        timestamp: '0:42',
        timestampSeconds: 42,
        content: 'Logo too small',
        category: ['design'],
        resolved: false,
        createdAt: new Date(),
        version: 1,
    },
];

export default function ReviewControlsPreviewPage() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(18);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [activeMode, setActiveMode] = useState<ReviewMode | null>('comment');
    const duration = 95;

    const comments = useMemo(() => MOCK_COMMENTS, []);

    return (
        <TooltipProvider>
            <div
                className="min-h-screen flex flex-col items-center justify-center p-8 gap-8"
                style={{ background: 'var(--review-bg-primary)', color: 'var(--review-text-primary)' }}
            >
                <div className="w-full max-w-3xl space-y-2">
                    <h1 className="text-sm font-semibold text-white/80 tracking-wide uppercase">
                        Desktop review controls preview
                    </h1>
                    <p className="text-xs text-[var(--review-text-muted)]">
                        Compact transport + mode pills (Comment / Draw / Voice / Range / Attach)
                    </p>
                </div>

                <div
                    className="w-full max-w-3xl rounded-xl border border-[var(--review-border)] overflow-hidden"
                    style={{ background: 'var(--review-bg-secondary)' }}
                >
                    <div className="aspect-video bg-black/80 flex items-center justify-center text-[var(--review-text-muted)] text-sm">
                        Video frame placeholder
                    </div>
                    <div className="px-4 py-3 space-y-3">
                        <ReviewCompactTransport
                            duration={duration}
                            currentTime={currentTime}
                            comments={comments}
                            activeCommentId="1"
                            currentVersionNumber={1}
                            onSeek={setCurrentTime}
                            onMarkerClick={(c) => setCurrentTime(c.timestampSeconds)}
                        />
                        <div className="flex items-center gap-3 text-sm">
                            <button
                                type="button"
                                onClick={() => setIsPlaying(v => !v)}
                                className="rounded px-2 py-1 hover:bg-white/10"
                            >
                                {isPlaying ? 'Pause' : 'Play'}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={duration}
                                value={currentTime}
                                onChange={(event) => setCurrentTime(Number(event.target.value))}
                                className="min-w-0 flex-1"
                                aria-label="Playback position"
                            />
                            <span className="font-mono text-xs text-[var(--review-text-muted)]">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                            <select
                                value={playbackSpeed}
                                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                                className="rounded bg-transparent px-1 py-1"
                                aria-label="Playback speed"
                            >
                                {[0.5, 1, 1.5, 2].map((speed) => (
                                    <option key={speed} value={speed}>{speed}×</option>
                                ))}
                            </select>
                        </div>
                        <ReviewModePills
                            activeMode={activeMode}
                            onSelect={setActiveMode}
                        />
                    </div>
                </div>

                <div className="text-xs text-[var(--review-text-muted)] font-mono">
                    mode={activeMode ?? 'none'} · t={formatTime(currentTime)} · {isPlaying ? 'playing' : 'paused'} · {isMuted ? 'muted' : 'sound'} · {playbackSpeed}×
                </div>
            </div>
        </TooltipProvider>
    );
}
