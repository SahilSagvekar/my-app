'use client';

import { useState } from 'react';
import { ReviewComment as ReviewCommentType, COMMENT_CATEGORIES } from './types';
import { MessageSquare, Check, Reply, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ReviewCommentProps {
    comment: ReviewCommentType;
    isActive?: boolean;
    onTimestampClick: (timestampSeconds: number) => void;
    onResolve: (commentId: string, resolved: boolean) => void;
    onReply?: (commentId: string) => void;
    onDelete?: (commentId: string) => void;
}

export function ReviewCommentCard({
    comment,
    isActive = false,
    onTimestampClick,
    onResolve,
    onReply,
    onDelete,
}: ReviewCommentProps) {
    const [showReplies, setShowReplies] = useState(false);

    const category = COMMENT_CATEGORIES.find(c => c.value === comment.category);

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <div
            className={`review-comment p-3 mb-2 review-animate-fade-in ${isActive ? 'active' : ''}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-medium text-white">
                        {comment.authorName.charAt(0).toUpperCase()}
                    </div>

                    {/* Author & Time */}
                    <div>
                        <div className="text-sm font-medium text-white">{comment.authorName}</div>
                        <div className="text-xs text-[var(--review-text-muted)]">
                            {formatTimeAgo(comment.createdAt)}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-elevated)]"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[var(--review-bg-elevated)] border-[var(--review-border)]">
                            {onReply && (
                                <DropdownMenuItem
                                    onClick={() => onReply(comment.id)}
                                    className="text-[var(--review-text-secondary)] hover:text-white hover:bg-[var(--review-bg-tertiary)]"
                                >
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                </DropdownMenuItem>
                            )}
                            {onDelete && (
                                <DropdownMenuItem
                                    onClick={() => onDelete(comment.id)}
                                    className="text-red-400 hover:text-red-300 hover:bg-[var(--review-bg-tertiary)]"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Timestamp & Category */}
            <div className="flex items-center gap-2 mb-2">
                <button
                    onClick={() => onTimestampClick(comment.timestampSeconds)}
                    className="review-comment-timestamp"
                >
                    @{comment.timestamp}
                </button>

                {category && (
                    <span
                        className="review-category-pill"
                        data-category={comment.category}
                    >
                        {category.label}
                    </span>
                )}
            </div>

            {/* Content */}
            <p className="text-sm text-[var(--review-text-secondary)] mb-3 leading-relaxed">
                {comment.content}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
                {/* Resolve Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={comment.resolved}
                        onChange={(e) => onResolve(comment.id, e.target.checked)}
                        className="review-resolve-checkbox"
                    />
                    <span className={`text-xs ${comment.resolved ? 'text-[var(--review-status-approved)]' : 'text-[var(--review-text-muted)] group-hover:text-[var(--review-text-secondary)]'}`}>
                        {comment.resolved ? 'Resolved' : 'Mark as resolved'}
                    </span>
                </label>

                {/* Reply count */}
                {comment.replies && comment.replies.length > 0 && (
                    <button
                        onClick={() => setShowReplies(!showReplies)}
                        className="flex items-center gap-1 text-xs text-[var(--review-text-muted)] hover:text-[var(--review-accent-purple)]"
                    >
                        <MessageSquare className="h-3 w-3" />
                        {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                    </button>
                )}
            </div>

            {/* Nested Replies */}
            {showReplies && comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-[var(--review-border)] space-y-2">
                    {comment.replies.map((reply) => (
                        <div key={reply.id} className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-medium text-white">
                                    {reply.authorName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-white">{reply.authorName}</span>
                                <span className="text-xs text-[var(--review-text-muted)]">
                                    {formatTimeAgo(reply.createdAt)}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--review-text-secondary)] ml-7">
                                {reply.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
