'use client';

import { Pencil, Mic, Clock, Paperclip, Grid3x3, ChevronDown } from 'lucide-react';
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
    /**
     * Draw captures a real pixel frame from the video element to annotate
     * over — impossible against a YouTube IFrame (cross-origin, no pixel
     * access). Pass false when videoSource.type === 'youtube' to hide it;
     * defaults to true everywhere else.
     */
    showDraw?: boolean;
}

const ALL_MODES: { id: ReviewMode; label: string; Icon: typeof Pencil }[] = [
    { id: 'draw', label: 'Draw', Icon: Pencil },
    { id: 'voice', label: 'Voice', Icon: Mic },
    { id: 'range', label: 'Range', Icon: Clock },
    { id: 'attach', label: 'Attach', Icon: Paperclip },
];

export function ReviewModePills({ activeMode, onSelect, disabled, instagramActive, gridActive, showInstagram, showGrid, showDraw = true }: ReviewModePillsProps) {
    const BASE_MODES = showDraw ? ALL_MODES : ALL_MODES.filter(m => m.id !== 'draw');
    const showGridDropdown = showInstagram || showGrid;
    const gridDropdownActive = !!instagramActive || !!gridActive;
    const pillCount = BASE_MODES.length + (showGridDropdown ? 1 : 0);

    return (
        <div className="review-mode-pills flex justify-center w-full px-2 flex-wrap">
            <div
                role="tablist"
                aria-label="Comment modes"
                className="inline-flex items-stretch flex-wrap rounded-md"
                style={{ border: '1px solid var(--review-v2-gray-600)' }}
            >
                {BASE_MODES.map(({ id, label, Icon }, index) => {
                    const isActive = activeMode === id;
                    return (
                        <div key={id} className="flex items-stretch">
                            {index > 0 && <span style={{ width: 1, background: 'var(--review-v2-gray-600)' }} />}
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                disabled={disabled}
                                onClick={() => onSelect(id)}
                                className="relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 border-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                style={isActive
                                    ? { background: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }
                                    : { background: 'transparent', color: 'var(--review-v2-gray-100)' }}
                            >
                                <Icon className="h-[15px] w-[15px]" strokeWidth={1.5} />
                                <span>{label}</span>
                            </button>
                        </div>
                    );
                })}

                {showGridDropdown && (
                    <div className="flex items-stretch">
                        <span style={{ width: 1, background: 'var(--review-v2-gray-600)' }} />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={gridDropdownActive}
                                    disabled={disabled}
                                    className="relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 border-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    style={gridDropdownActive
                                        ? { background: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }
                                        : { background: 'transparent', color: 'var(--review-v2-gray-100)' }}
                                >
                                    <Grid3x3 className="h-[15px] w-[15px]" strokeWidth={1.5} />
                                    <span>Grid</span>
                                    <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                align="start"
                                className="min-w-[170px] p-2"
                                style={{ background: 'var(--review-bg-secondary)', border: '1px solid var(--review-border)' }}
                            >
                                {showInstagram && (
                                    <DropdownMenuCheckboxItem
                                        checked={!!instagramActive}
                                        onCheckedChange={() => onSelect('instagram')}
                                        className="cursor-pointer text-sm rounded-md py-2.5 px-3"
                                        style={{ color: instagramActive ? '#fff' : 'var(--review-v2-gray-300)' }}
                                    >
                                        Instagram
                                    </DropdownMenuCheckboxItem>
                                )}
                                {showGrid && (
                                    <DropdownMenuCheckboxItem
                                        checked={!!gridActive}
                                        onCheckedChange={() => onSelect('grid')}
                                        className="cursor-pointer text-sm rounded-md py-2.5 px-3"
                                        style={{ color: gridActive ? '#fff' : 'var(--review-v2-gray-300)' }}
                                    >
                                        Safeguards
                                    </DropdownMenuCheckboxItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>
        </div>
    );
}