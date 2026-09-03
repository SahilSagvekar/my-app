'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, Repeat2, Menu, Music2, Pencil } from 'lucide-react';

interface ReviewInstagramOverlayProps {
    /** Prefilled from the task's client/account name — editable. */
    defaultUsername: string;
    /** Real comment count from the review, shown on the comment-bubble icon. */
    commentCount?: number;
}

function initialsFrom(name: string): string {
    const clean = name.replace(/^@/, '').trim();
    if (!clean) return '?';
    const parts = clean.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toHandle(name: string): string {
    const clean = name.trim().replace(/^@/, '');
    if (!clean) return '@youraccount';
    return '@' + clean.toLowerCase().replace(/[^a-z0-9._]+/g, '');
}

function formatCount(n: number): string {
    if (n < 1000) return String(n);
    if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    if (n < 1_000_000) return Math.round(n / 1000) + 'K';
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

/**
 * Reels-style chrome overlaid on top of the (still-playing) video, so
 * reviewers can judge a clip roughly as it will look once posted — closely
 * modeled on the real Reels layout: right-side action rail (like, comment,
 * repost, share, save, more, audio disc) with counts stacked below each
 * icon, and bottom-left profile row + caption + audio ticker.
 *
 * Preview only: nothing here is persisted. `pointer-events-none` on the
 * wrapper keeps the underlying play/pause tap area working; only the
 * editable text and the cosmetic action icons opt back in to pointer
 * events.
 */
export function ReviewInstagramOverlay({ defaultUsername, commentCount = 0 }: ReviewInstagramOverlayProps) {
    const [username, setUsername] = useState(toHandle(defaultUsername));
    const [editingUsername, setEditingUsername] = useState(false);

    const [caption, setCaption] = useState('Write your caption…');
    const [editingCaption, setEditingCaption] = useState(false);

    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [likeCount, setLikeCount] = useState(1284);
    const [repostCount] = useState(214);
    const [shareCount] = useState(432);

    const toggleLike = () => {
        setLiked(v => !v);
        setLikeCount(c => (liked ? c - 1 : c + 1));
    };

    return (
        <div className="absolute inset-0 z-[105] pointer-events-none select-none">
            {/* Bottom legibility gradient */}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            {/* Bottom-left: profile row + caption + audio ticker */}
            <div className="absolute left-0 right-16 bottom-4 px-3.5 pointer-events-auto">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px] shrink-0">
                        <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-white">
                            {initialsFrom(username)}
                        </div>
                    </div>

                    {editingUsername ? (
                        <input
                            autoFocus
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onBlur={() => setEditingUsername(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
                            }}
                            className="bg-black/40 border border-white/25 rounded px-1.5 py-0.5 text-[15px] font-semibold text-white outline-none w-40"
                        />
                    ) : (
                        <button
                            onClick={() => setEditingUsername(true)}
                            className="flex items-center gap-1 text-[15px] font-semibold text-white hover:opacity-80 transition-opacity"
                            title="Edit handle"
                        >
                            {username}
                            <Pencil className="h-2.5 w-2.5 text-white/50" />
                        </button>
                    )}

                    <span className="text-[13px] font-semibold text-white border border-white rounded-md px-2.5 py-[3px] ml-1">
                        Follow
                    </span>
                </div>

                {editingCaption ? (
                    <textarea
                        autoFocus
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        onBlur={() => setEditingCaption(false)}
                        rows={2}
                        className="w-full max-w-[280px] bg-black/40 border border-white/25 rounded px-1.5 py-1 text-[13px] leading-snug text-white outline-none resize-none"
                    />
                ) : (
                    <button
                        onClick={() => setEditingCaption(true)}
                        className="text-left text-[13px] leading-snug text-white max-w-[280px] hover:opacity-80 transition-opacity flex items-start gap-1"
                        title="Edit caption"
                    >
                        <span className="truncate">{caption}</span>
                        <Pencil className="h-2.5 w-2.5 text-white/50 mt-0.5 shrink-0" />
                    </button>
                )}

                <div className="flex items-center gap-1.5 mt-2 text-[12px] text-white/90">
                    <Music2 className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[240px]">Original audio · {username.replace(/^@/, '')}</span>
                </div>
            </div>

            {/* Right-side action rail */}
            <div className="absolute right-2.5 bottom-5 flex flex-col items-center gap-[18px] pointer-events-auto">
                <button onClick={toggleLike} className="flex flex-col items-center gap-1 group">
                    <Heart
                        className={`h-7 w-7 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-white group-hover:text-white/80'}`}
                        strokeWidth={1.75}
                    />
                    <span className="text-[11px] font-semibold text-white">{formatCount(likeCount)}</span>
                </button>

                <button className="flex flex-col items-center gap-1 group">
                    <MessageCircle className="h-7 w-7 text-white group-hover:text-white/80" strokeWidth={1.75} />
                    <span className="text-[11px] font-semibold text-white">{formatCount(commentCount)}</span>
                </button>

                <button className="flex flex-col items-center gap-1 group">
                    <Repeat2 className="h-7 w-7 text-white group-hover:text-white/80" strokeWidth={1.75} />
                    <span className="text-[11px] font-semibold text-white">{formatCount(repostCount)}</span>
                </button>

                <button className="flex flex-col items-center gap-1 group">
                    <Send className="h-7 w-7 text-white group-hover:text-white/80" strokeWidth={1.75} />
                    <span className="text-[11px] font-semibold text-white">{formatCount(shareCount)}</span>
                </button>

                <button onClick={() => setSaved(v => !v)} className="flex flex-col items-center gap-1 group">
                    <Bookmark className={`h-7 w-7 transition-colors ${saved ? 'fill-white text-white' : 'text-white group-hover:text-white/80'}`} strokeWidth={1.75} />
                </button>

                <button className="flex flex-col items-center gap-1 group">
                    <Menu className="h-6 w-6 text-white group-hover:text-white/80" strokeWidth={2} />
                </button>

                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] ring-1 ring-white/40 mt-0.5 flex items-center justify-center overflow-hidden">
                    <Music2 className="h-3 w-3 text-white" />
                </div>
            </div>
        </div>
    );
}