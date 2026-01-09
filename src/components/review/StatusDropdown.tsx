'use client';

import { REVIEW_STATUSES, ReviewStatus } from './types';
import { ChevronDown, Check } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface StatusDropdownProps {
    currentStatus: ReviewStatus['value'];
    onStatusChange: (status: ReviewStatus['value']) => void;
    disabled?: boolean;
}

export function StatusDropdown({
    currentStatus,
    onStatusChange,
    disabled = false,
}: StatusDropdownProps) {
    const current = REVIEW_STATUSES.find((s) => s.value === currentStatus) || REVIEW_STATUSES[0];

    const getStatusStyles = (status: ReviewStatus['value']) => {
        switch (status) {
            case 'approved':
                return 'bg-[var(--review-status-approved)] text-white';
            case 'needs_changes':
                return 'bg-[var(--review-status-changes)] text-white';
            case 'in_progress':
                return 'bg-[var(--review-status-progress)] text-white';
            default:
                return 'bg-[var(--review-bg-tertiary)] text-[var(--review-text-secondary)] border border-[var(--review-border)]';
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={disabled}
                className={`
          review-status-dropdown
          inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
          transition-all duration-200 ease-out
          ${getStatusStyles(currentStatus)}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}
        `}
                data-status={currentStatus}
            >
                <span className="flex items-center gap-2">
                    {currentStatus === 'approved' && <Check className="h-4 w-4" />}
                    {current.label}
                </span>
                {!disabled && <ChevronDown className="h-4 w-4" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-48 bg-[var(--review-bg-elevated)] border-[var(--review-border)] shadow-xl"
            >
                {REVIEW_STATUSES.map((status) => (
                    <DropdownMenuItem
                        key={status.value}
                        onClick={() => onStatusChange(status.value)}
                        className={`
              flex items-center justify-between gap-2 cursor-pointer
              ${currentStatus === status.value
                                ? 'bg-[var(--review-bg-tertiary)] text-white'
                                : 'text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]'
                            }
            `}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: status.color }}
                            />
                            <span>{status.label}</span>
                        </div>
                        {currentStatus === status.value && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
