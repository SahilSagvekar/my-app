'use client';

import { MessageSquare, Pencil, Mic, Clock, Paperclip, Instagram, Grid3x3 } from 'lucide-react';

export type ReviewMode = 'comment' | 'draw' | 'voice' | 'range' | 'attach' | 'instagram' | 'grid';

interface ReviewModePillsProps {
    activeMode: ReviewMode | null;
    onSelect: (mode: ReviewMode) => void;
    disabled?: boolean;
    /**
     * Instagram and Grid are standalone overlay toggles, not part of the
     * comment/draw/voice/range/attach mutual-exclusivity group — either can
     * stay highlighted while one of those is also active, so they're
     * tracked separately from `activeMode`. Instagram and Grid ARE mutually
     * exclusive with each other, but that's enforced by the caller (only
     * one of instagramActive/gridActive should ever be true at once).
     */
    instagramActive?: boolean;
    gridActive?: boolean;
    /** Only short-form tasks get these Reels-check tools — hidden otherwise. */
    showInstagram?: boolean;
    showGrid?: boolean;
}

const BASE_MODES: { id: ReviewMode; label: string; Icon: typeof MessageSquare }[] = [
    { id: 'comment', label: 'Comment', Icon: MessageSquare },
    { id: 'draw', label: 'Draw', Icon: Pencil },
    { id: 'voice', label: 'Voice', Icon: Mic },
    { id: 'range', label: 'Range', Icon: Clock },
    { id: 'attach', label: 'Attach', Icon: Paperclip },
];

const INSTAGRAM_MODE = { id: 'instagram' as const, label: 'Instagram', Icon: Instagram };
const GRID_MODE = { id: 'grid' as const, label: 'Grid', Icon: Grid3x3 };

export function ReviewModePills({ activeMode, onSelect, disabled, instagramActive, gridActive, showInstagram, showGrid }: ReviewModePillsProps) {
    const MODES = [
        ...BASE_MODES,
        ...(showInstagram ? [INSTAGRAM_MODE] : []),
        ...(showGrid ? [GRID_MODE] : []),
    ];
    return (
        <div className="review-mode-pills flex justify-center w-full px-2">
            <div
                role="tablist"
                aria-label="Comment modes"
                className="inline-flex items-stretch rounded-full border border-[var(--review-border)] bg-[var(--review-bg-tertiary)]/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
                {MODES.map(({ id, label, Icon }, index) => {
                    const isActive = id === 'instagram' ? !!instagramActive : id === 'grid' ? !!gridActive : activeMode === id;
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