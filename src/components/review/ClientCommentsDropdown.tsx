'use client';

// Shared "Client comments — all versions" toolbar button + dropdown.
// Used by the video review screen (ReviewScreenDesktop) and the hard post /
// image review (ThumbnailReviewModal).

import { useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import type { ReviewComment } from './types';

interface ClientCommentsDropdownProps {
    comments: ReviewComment[];
    onJump: (comment: ReviewComment) => void;
    /** Optional extra badge per row, e.g. "Image 3" on hard post reviews. */
    getLocationLabel?: (comment: ReviewComment) => string | null;
}

export function ClientCommentsDropdown({ comments, onJump, getLocationLabel }: ClientCommentsDropdownProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    // The review screens are modal Radix Dialogs. A modal Dialog blocks
    // mouse-wheel scrolling on anything rendered outside its own DOM tree, and
    // dropdown menus portal to <body> by default, so the list could not be
    // scrolled with the wheel. Portal the menu into the dialog element instead.
    const [container, setContainer] = useState<HTMLElement | null>(null);

    if (comments.length === 0) return null;

    return (
        <DropdownMenu
            onOpenChange={open => {
                if (open) {
                    setContainer(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
                }
            }}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <button
                            ref={triggerRef}
                            title="Client comments — all versions"
                            className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors relative"
                            style={{ border: '1px solid var(--review-border-hover)', color: 'var(--review-v2-gray-100)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-bg-tertiary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.5} />
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white pointer-events-none">
                                {comments.length}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Client comments — all versions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
                align="end"
                container={container}
                // Belt and braces: keep wheel events from reaching any
                // scroll-lock handler sitting above this menu.
                onWheel={e => e.stopPropagation()}
                className="w-80 max-h-96 overflow-y-auto overscroll-contain bg-[var(--review-bg-elevated)] border-[var(--review-border)]"
            >
                <DropdownMenuLabel className="text-white text-xs">
                    Client comments — all versions
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--review-border)]" />
                {comments.map(comment => {
                    const location = getLocationLabel?.(comment);
                    return (
                        <DropdownMenuItem
                            key={comment.id}
                            onClick={() => onJump(comment)}
                            className="flex flex-col items-start gap-0.5 whitespace-normal text-[var(--review-text-secondary)] focus:bg-[var(--review-bg-tertiary)] focus:text-white cursor-pointer"
                        >
                            <div className="flex items-center gap-2 w-full">
                                <span className="text-xs font-semibold text-white truncate">{comment.authorName}</span>
                                {location && (
                                    <Badge className="bg-[var(--review-bg-tertiary)] text-[10px] px-1.5 py-0 shrink-0">{location}</Badge>
                                )}
                                <Badge className="bg-[var(--review-bg-tertiary)] text-[10px] px-1.5 py-0 shrink-0">V{comment.version ?? 1}</Badge>
                                <span className="text-[10px] text-[var(--review-text-muted)] ml-auto shrink-0">{comment.timestamp}</span>
                            </div>
                            <p className="text-xs leading-snug break-words">{comment.content}</p>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
