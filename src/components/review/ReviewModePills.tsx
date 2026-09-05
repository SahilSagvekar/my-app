'use client';

import { Pencil, Mic, Clock, Paperclip, Grid3x3, Globe } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export type ReviewMode = 'comment' | 'draw' | 'voice' | 'range' | 'general' | 'attach' | 'instagram' | 'grid';

interface ReviewModePillsProps {
    activeMode: ReviewMode | null;
    onSelect: (mode: ReviewMode) => void;
    disabled?: boolean;
    /**
     * Instagram and Overlay (the safe-zone guide, internally mode 'grid')
     * are standalone overlay toggles, not part of the comment/draw/voice/
     * range/attach mutual-exclusivity group — either can stay highlighted
     * while one of those is also active, so they're tracked separately
     * from `activeMode`. They're both surfaced from a single "Grid"
     * dropdown pill, and are mutually exclusive with each other — enforced
     * by the caller (only one of instagramActive/gridActive should ever be
     * true at once).
     */
    instagramActive?: boolean;
    gridActive?: boolean;
    /** Only short-form tasks get the Grid dropdown — hidden otherwise. */
    showInstagram?: boolean;
    showGrid?: boolean;
}

const BASE_MODES: { id: ReviewMode; label: string; Icon: typeof Pencil }[] = [
    { id: 'draw', label: 'Draw', Icon: Pencil },
    { id: 'voice', label: 'Voice', Icon: Mic },
    { id: 'range', label: 'Range', Icon: Clock },
    { id: 'general', label: 'General', Icon: Globe },
    { id: 'attach', label: 'Attach', Icon: Paperclip },
];

export function ReviewModePills({ activeMode, onSelect, disabled, instagramActive, gridActive, showInstagram, showGrid }: ReviewModePillsProps) {
    const showGridDropdown = showInstagram || showGrid;
    const gridDropdownActive = !!instagramActive || !!gridActive;
    const pillCount = BASE_MODES.length + (showGridDropdown ? 1 : 0);

    return (
        <div className="review-mode-pills flex justify-center w-full px-2">
            <div
                role="tablist"
                aria-label="Comment modes"
                className="inline-flex items-stretch rounded-full border border-[var(--review-border)] bg-[var(--review-bg-tertiary)]/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
                {BASE_MODES.map(({ id, label, Icon }, index) => {
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
                                index === pillCount - 1 ? 'rounded-r-full' : '',
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

                {showGridDropdown && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={gridDropdownActive}
                                disabled={disabled}
                                className={[
                                    'relative flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-150 rounded-r-full',
                                    'disabled:opacity-40 disabled:cursor-not-allowed',
                                    gridDropdownActive
                                        ? 'bg-[var(--review-bg-elevated)] text-white shadow-sm ring-1 ring-white/10'
                                        : 'text-[var(--review-text-muted)] hover:text-white',
                                ].join(' ')}
                            >
                                <Grid3x3 className={`h-3 w-3 ${gridDropdownActive ? 'text-[var(--review-accent-purple)]' : ''}`} />
                                <span>Grid</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center">
                            {showInstagram && (
                                <DropdownMenuCheckboxItem
                                    checked={!!instagramActive}
                                    onCheckedChange={() => onSelect('instagram')}
                                >
                                    Instagram
                                </DropdownMenuCheckboxItem>
                            )}
                            {showGrid && (
                                <DropdownMenuCheckboxItem
                                    checked={!!gridActive}
                                    onCheckedChange={() => onSelect('grid')}
                                >
                                    Overlay
                                </DropdownMenuCheckboxItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
}