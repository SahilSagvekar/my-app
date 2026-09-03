'use client';

import { MessageSquare, Pencil, Mic, Clock, Paperclip, Instagram } from 'lucide-react';

export type ReviewMode = 'comment' | 'draw' | 'voice' | 'range' | 'attach' | 'instagram';

interface ReviewModePillsProps {
    activeMode: ReviewMode | null;
    onSelect: (mode: ReviewMode) => void;
    disabled?: boolean;
    /**
     * Instagram is a standalone overlay toggle, not part of the
     * comment/draw/voice/range/attach mutual-exclusivity group — it can
     * stay highlighted while one of those is also active, so it's tracked
     * separately from `activeMode`.
     */
    instagramActive?: boolean;
    /** Only short-form tasks get an Instagram preview — hidden otherwise. */
    showInstagram?: boolean;
}

const BASE_MODES: { id: ReviewMode; label: string; Icon: typeof MessageSquare }[] = [
    { id: 'comment', label: 'Comment', Icon: MessageSquare },
    { id: 'draw', label: 'Draw', Icon: Pencil },
    { id: 'voice', label: 'Voice', Icon: Mic },
    { id: 'range', label: 'Range', Icon: Clock },
    { id: 'attach', label: 'Attach', Icon: Paperclip },
];

const INSTAGRAM_MODE = { id: 'instagram' as const, label: 'Instagram', Icon: Instagram };

export function ReviewModePills({ activeMode, onSelect, disabled, instagramActive, showInstagram }: ReviewModePillsProps) {
    const MODES = showInstagram ? [...BASE_MODES, INSTAGRAM_MODE] : BASE_MODES;
    return (
        <div className="review-mode-pills flex justify-center w-full px-2">
            <div
                role="tablist"
                aria-label="Comment modes"
                className="inline-flex items-stretch rounded-full border border-[var(--review-border)] bg-[var(--review-bg-tertiary)]/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
                {MODES.map(({ id, label, Icon }, index) => {
                    const isActive = id === 'instagram' ? !!instagramActive : activeMode === id;
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