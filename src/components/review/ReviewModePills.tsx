'use client';

import { MessageSquare, Pencil, Mic, Clock, Paperclip } from 'lucide-react';

export type ReviewMode = 'comment' | 'draw' | 'voice' | 'range' | 'attach';

interface ReviewModePillsProps {
    activeMode: ReviewMode | null;
    onSelect: (mode: ReviewMode) => void;
    disabled?: boolean;
}

const MODES: { id: ReviewMode; label: string; Icon: typeof MessageSquare }[] = [
    { id: 'comment', label: 'Comment', Icon: MessageSquare },
    { id: 'draw', label: 'Draw', Icon: Pencil },
    { id: 'voice', label: 'Voice', Icon: Mic },
    { id: 'range', label: 'Range', Icon: Clock },
    { id: 'attach', label: 'Attach', Icon: Paperclip },
];

export function ReviewModePills({ activeMode, onSelect, disabled }: ReviewModePillsProps) {
    return (
        <div className="review-mode-pills flex justify-center w-full px-2">
            <div
                role="tablist"
                aria-label="Comment modes"
                className="inline-flex items-stretch rounded-full border border-[var(--review-border)] bg-[var(--review-bg-tertiary)]/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
                {MODES.map(({ id, label, Icon }, index) => {
                    const isActive = activeMode === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            disabled={disabled}
                            onClick={() => onSelect(id)}
                            className={[
                                'relative flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-150',
                                'disabled:opacity-40 disabled:cursor-not-allowed',
                                index === 0 ? 'rounded-l-full' : '',
                                index === MODES.length - 1 ? 'rounded-r-full' : '',
                                isActive
                                    ? 'bg-[var(--review-bg-elevated)] text-white shadow-sm ring-1 ring-white/10'
                                    : 'text-[var(--review-text-muted)] hover:text-white',
                            ].join(' ')}
                        >
                            <Icon className={`h-3 w-3 ${isActive ? 'text-[var(--review-accent-purple)]' : ''}`} />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
