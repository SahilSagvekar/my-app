'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import {
    X,
    Download,
    CheckCircle2,
    MessageSquare,
    ArrowLeft,
    Maximize,
    LayoutGrid,
    Plus,
    PenLine,
    Film,
} from 'lucide-react';
import { toast } from 'sonner';
import { ReviewCommentCard, CommentInput } from '../review';
import { ReviewComment } from '../review/types';
import { useAuth } from '../auth/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

/* ─── Types ────────────────────────────────────────────────────── */
interface TaskFile {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
    uploadedBy: string;
    driveFileId: string;
    mimeType: string;
    size: number;
    folderType?: string;
    version?: number;
    isActive?: boolean;
    replacedAt?: string;
    revisionNote?: string;
    s3Key?: string;
    downloadUrl?: string;
}

interface ThumbnailReviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: TaskFile | null;
    allFiles: TaskFile[];
    taskId: string;
    taskTitle: string;
    onApprove: (file: TaskFile) => void | Promise<void>;
    onRequestRevisions: (file: TaskFile, feedback: any[]) => void | Promise<void>;
    onSwitchToVideo?: () => void;
    userRole?: 'client' | 'qc';
    imageLabel?: string;
    postingTitles?: { id: string; text: string }[];
    postingDescriptions?: { id: string; text: string }[];
    postingTags?: { id: string; text: string }[];
    onPostingTitlesChange?: (items: { id: string; text: string }[]) => void;
    onPostingDescriptionsChange?: (items: { id: string; text: string }[]) => void;
    onPostingTagsChange?: (items: { id: string; text: string }[]) => void;
}

/* ─── Component ─────────────────────────────────────────────────── */
export function ThumbnailReviewModal({
    open,
    onOpenChange,
    file,
    allFiles,
    taskId,
    taskTitle,
    onApprove,
    onRequestRevisions,
    onSwitchToVideo,
    userRole = 'client',
    imageLabel = 'Thumbnails',
    postingTitles = [],
    postingDescriptions = [],
    postingTags = [],
    onPostingTitlesChange,
    onPostingDescriptionsChange,
    onPostingTagsChange,
}: ThumbnailReviewModalProps) {
    const { user } = useAuth();

    /* ── UI state ── */
    const [currentFile, setCurrentFile] = useState<TaskFile | null>(null);
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [savingFeedback, setSavingFeedback] = useState(false);
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);
    const [viewMode, setViewMode] = useState<'single' | 'gallery'>('gallery');

    /* ── Sidebar tabs ── */
    type SidebarTab = 'comments' | 'titles';
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('comments');

    /* ── Titles / descriptions editing state ── */
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [newTexts, setNewTexts] = useState({ titles: '', descriptions: '' });
    const CAPS = { titles: 3, descriptions: 3 };

    /* ── Derived data ── */
    const orderedThumbnails = useMemo(() =>
        allFiles
            .filter(f => f.folderType === (file?.folderType || 'thumbnails'))
            .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()),
        [file, allFiles],
    );

    const currentNumber = useMemo(() => {
        if (!currentFile) return 1;
        return orderedThumbnails.findIndex(t => t.id === currentFile.id) + 1;
    }, [currentFile, orderedThumbnails]);

    const unresolvedCount = comments.filter(c => !c.resolved).length;

    /* ── Initialise on file change ── */
    useEffect(() => {
        if (file) {
            setCurrentFile(file);
            setComments([]);
            setShowCommentInput(false);
            fetchFeedback(file.id);
        }
    }, [file]);

    /* ── Data fetching ── */
    const fetchFeedback = async (fileId: string) => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.feedback) {
                const fileFeedback = data.feedback
                    .filter((fb: any) => fb.fileId === fileId)
                    .map((fb: any) => ({
                        id: fb.id,
                        taskId,
                        authorId: String(fb.user?.id || 0),
                        authorName: fb.user?.name || 'Member',
                        content: fb.feedback,
                        timestamp: fb.timestamp || '0:00',
                        timestampSeconds: 0,
                        category: fb.category || 'other',
                        createdAt: new Date(fb.createdAt),
                        resolved: fb.status === 'resolved',
                        version: fb.file?.version || 1,
                    }));
                setComments(fileFeedback);
            }
        } catch (err) {
            console.error('Error fetching feedback:', err);
        }
    };

    /* ── Comment handlers ── */
    const handleCommentSubmit = async (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => {
        const newComment: ReviewComment = {
            ...comment,
            id: Date.now().toString(),
            createdAt: new Date(),
            version: currentNumber,
        };
        setComments(prev => [newComment, ...prev]);
        setShowCommentInput(false);
    };

    /* ── Approval / revision handlers ── */
    const handleApproveClick = async () => {
        if (!currentFile) return;
        setShowApprovalSuccess(true);
        onApprove(currentFile);
        setTimeout(() => { setShowApprovalSuccess(false); onOpenChange(false); }, 2000);
    };

    const handleRequestRevisionsClick = async () => {
        if (!currentFile) return;
        if (unresolvedCount === 0) {
            toast.error('Please add at least one comment for revisions');
            return;
        }
        try {
            setSavingFeedback(true);
            const feedbackItems = comments
                .filter(c => !c.resolved)
                .map(c => ({
                    folderType: currentFile.folderType || 'thumbnails',
                    fileId: currentFile.id,
                    feedback: c.content,
                    category: c.category,
                    timestamp: '0:00',
                }));
            const res = await fetch(`/api/tasks/${taskId}/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackItems, createdBy: user?.id || 0 }),
            });
            if (!res.ok) throw new Error('Failed to save feedback');
            setShowRevisionSuccess(true);
            onRequestRevisions(currentFile, feedbackItems);
            setTimeout(() => { setShowRevisionSuccess(false); onOpenChange(false); }, 2000);
        } catch (err) {
            console.error('Error requesting revisions:', err);
            toast.error('Failed to save feedback');
        } finally {
            setSavingFeedback(false);
        }
    };

    /* ── Download ── */
    const handleDownload = () => {
        if (!currentFile) return;
        const isS3 =
            currentFile.url?.includes('amazonaws.com') ||
            currentFile.url?.includes('r2.cloudflarestorage.com') ||
            currentFile.url?.includes('r2.dev');
        if (isS3) {
            window.open(`/api/files/${currentFile.id}/download`, '_blank');
            toast.success('Download started');
        } else if (currentFile.downloadUrl) {
            window.open(currentFile.downloadUrl, '_blank');
        } else {
            window.open(currentFile.url, '_blank');
        }
    };

    /* ── Titles / descriptions CRUD ── */
    const addItem = (type: 'titles' | 'descriptions') => {
        const text = newTexts[type].trim();
        if (!text) return;
        const cap = CAPS[type];
        const currentList = type === 'titles' ? postingTitles : postingDescriptions;
        const setCurrentList = type === 'titles' ? onPostingTitlesChange : onPostingDescriptionsChange;
        if (!setCurrentList || currentList.length >= cap) return;
        setCurrentList([...currentList, { id: `${Date.now()}-${Math.random()}`, text }]);
        setNewTexts(prev => ({ ...prev, [type]: '' }));
    };

    const deleteItem = (type: 'titles' | 'descriptions', id: string) => {
        const currentList = type === 'titles' ? postingTitles : postingDescriptions;
        const setCurrentList = type === 'titles' ? onPostingTitlesChange : onPostingDescriptionsChange;
        if (!setCurrentList) return;
        if (type === 'titles' && userRole === 'client' && currentList.length <= 1) return;
        setCurrentList(currentList.filter(i => i.id !== id));
    };

    const startEdit = (id: string, text: string) => { setEditingId(id); setEditingText(text); };

    const commitEdit = (type: 'titles' | 'descriptions') => {
        if (!editingId) return;
        const currentList = type === 'titles' ? postingTitles : postingDescriptions;
        const setCurrentList = type === 'titles' ? onPostingTitlesChange : onPostingDescriptionsChange;
        if (!setCurrentList) return;
        const text = editingText.trim();
        if (text) setCurrentList(currentList.map(i => i.id === editingId ? { ...i, text } : i));
        setEditingId(null);
        setEditingText('');
    };

    const handleTabChange = (tab: SidebarTab) => {
        setSidebarTab(tab);
        setNewTexts({ titles: '', descriptions: '' });
        setEditingId(null);
        setEditingText('');
    };

    /* ── Guard ── */
    if (!currentFile) return null;

    /* ─────────────────────────────────────────────────────────── */
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!fixed !inset-0 !z-50 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !overflow-hidden !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none fullscreen-dialog review-modal">
                <TooltipProvider delayDuration={300}>
                    <div className="sr-only">
                        <DialogTitle>Review {currentFile.name}</DialogTitle>
                        <DialogDescription>Review and provide feedback on this image.</DialogDescription>
                    </div>

                    <div className="relative w-full h-full flex flex-col" style={{ background: 'var(--review-bg-primary)' }}>

                        {/* ── Success overlays ── */}
                        {showApprovalSuccess && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in">
                                <Card className="bg-green-900/50 border-green-500/50 backdrop-blur-xl">
                                    <CardContent className="p-8 text-center">
                                        <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                        <h3 className="text-xl font-medium text-green-100 mb-2">Approved!</h3>
                                        <p className="text-green-300/80">Feedback has been recorded.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                        {showRevisionSuccess && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 review-animate-fade-in">
                                <Card className="bg-orange-900/50 border-orange-500/50 backdrop-blur-xl">
                                    <CardContent className="p-8 text-center">
                                        <MessageSquare className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                                        <h3 className="text-xl font-medium text-orange-100 mb-2">Revisions Requested</h3>
                                        <p className="text-orange-300/80">{comments.length} comment{comments.length !== 1 ? 's' : ''} saved to task.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* ── HEADER ── */}
                        <div className="flex-shrink-0 review-header px-6 py-3">
                            <div className="flex items-center justify-between">
                                {/* Left: back + title */}
                                <div className="flex items-center gap-4">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)]">
                                                <ArrowLeft className="h-4 w-4 mr-2" /> Back
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Go back</TooltipContent>
                                    </Tooltip>

                                    <div className="h-6 w-px bg-[var(--review-border)]" />

                                    <div>
                                        <h1 className="text-lg font-medium text-white">{taskTitle}</h1>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge className="bg-purple-600/80 text-white text-xs border-none capitalize">
                                                {currentFile.folderType}
                                            </Badge>
                                            <span className="text-sm text-[var(--review-text-muted)]">
                                                {imageLabel} &bull; {orderedThumbnails.length} image{orderedThumbnails.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: icon-only actions */}
                                <div className="flex items-center gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="sm"
                                                onClick={() => setViewMode(v => v === 'gallery' ? 'single' : 'gallery')}
                                                className={`text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0 ${viewMode === 'single' ? 'bg-[var(--review-bg-tertiary)]' : ''}`}
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">{viewMode === 'gallery' ? 'Single view' : 'Gallery view'}</TooltipContent>
                                    </Tooltip>

                                    {onSwitchToVideo && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    onClick={onSwitchToVideo}
                                                    className="text-[var(--review-text-muted)] hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0"
                                                >
                                                    <Film className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">Switch to Video Review</TooltipContent>
                                        </Tooltip>
                                    )}

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="sm"
                                                onClick={handleDownload}
                                                className="text-white hover:text-white hover:bg-[var(--review-bg-tertiary)] h-8 w-8 p-0"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Download</TooltipContent>
                                    </Tooltip>

                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => onOpenChange(false)}
                                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* ── BODY ── */}
                        <div className="flex-1 flex overflow-hidden min-h-0">

                            {/* ── IMAGE AREA ── */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {viewMode === 'gallery' ? (
                                    /* Gallery grid */
                                    <div className="flex-1 overflow-auto p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto items-start">
                                            {orderedThumbnails.map((t, idx) => (
                                                <div
                                                    key={t.id}
                                                    className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer ${
                                                        currentFile.id === t.id
                                                            ? 'border-purple-500 ring-2 ring-purple-500/30'
                                                            : 'border-[var(--review-border)] hover:border-white/20'
                                                    }`}
                                                    onClick={() => { setCurrentFile(t); setViewMode('single'); }}
                                                >
                                                    <div className="aspect-video relative">
                                                        <img src={t.url} alt={t.name} className="w-full h-full object-cover" />
                                                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                                                            <span className="text-white font-bold text-sm">#{idx + 1}</span>
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Button variant="secondary" size="sm" className="bg-white text-black hover:bg-zinc-200">
                                                                Review Details
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-[var(--review-bg-secondary)] border-t border-[var(--review-border)] flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--review-text-muted)] font-medium truncate max-w-[160px]">{t.name}</span>
                                                        {comments.some(c => c.version === (idx + 1)) && (
                                                            <Badge className="bg-orange-500/20 text-orange-500 text-[9px] border-none flex items-center gap-1">
                                                                <MessageSquare className="h-2.5 w-2.5" />
                                                                {comments.filter(c => c.version === (idx + 1)).length}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Single image view */
                                    <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden p-8">
                                        <div className="relative group max-w-full max-h-full">
                                            <img
                                                src={currentFile.url}
                                                alt={currentFile.name}
                                                className="max-w-full max-h-[calc(100vh-200px)] object-contain shadow-2xl rounded-sm"
                                            />
                                            <div className="absolute top-4 left-4 bg-purple-600 text-white px-4 py-1.5 rounded-lg font-bold text-lg shadow-xl">
                                                #{currentNumber}
                                            </div>
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon" variant="secondary"
                                                    className="bg-black/50 hover:bg-black/80 text-white border-none"
                                                    onClick={() => window.open(currentFile.url, '_blank')}
                                                >
                                                    <Maximize className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Floating thumbnail picker */}
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--review-bg-secondary)]/90 backdrop-blur-md border border-[var(--review-border)] rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl">
                                            <span className="text-[10px] font-bold text-[var(--review-text-muted)] uppercase tracking-widest mr-2">
                                                {imageLabel}
                                            </span>
                                            {orderedThumbnails.map((t, idx) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setCurrentFile(t)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                        currentFile.id === t.id
                                                            ? 'bg-purple-600 text-white'
                                                            : 'text-[var(--review-text-muted)] hover:bg-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            ))}
                                            <div className="h-4 w-px bg-[var(--review-border)] mx-1" />
                                            <button
                                                onClick={() => setViewMode('gallery')}
                                                className="p-1.5 rounded-lg text-[var(--review-text-muted)] hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── SIDEBAR ── */}
                            <div
                                className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l border-[var(--review-border)]"
                                style={{ background: 'var(--review-bg-secondary)', height: 'calc(100vh - 57px)' }}
                            >
                                {/* Tab switcher */}
                                <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['comments', 'titles'] as const).map(tab => {
                                            const isComments = tab === 'comments';
                                            const isActive = sidebarTab === tab;
                                            const colorClasses = isComments
                                                ? `border-blue-500 text-white hover:bg-blue-500 hover:text-white ${isActive ? 'bg-blue-500/20' : 'bg-transparent'}`
                                                : `border-orange-500 text-white hover:bg-orange-500 hover:text-white ${isActive ? 'bg-orange-500/20' : 'bg-transparent'}`;
                                            return (
                                                <button
                                                    key={tab}
                                                    onClick={() => handleTabChange(tab)}
                                                    className={`text-[11px] font-semibold py-1.5 px-2 rounded-md transition-colors capitalize border ${colorClasses}`}
                                                >
                                                    {tab === 'comments'
                                                        ? `Comments${comments.length ? ` (${comments.length})` : ''}`
                                                        : 'Titles'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ── COMMENTS TAB ── */}
                                {sidebarTab === 'comments' && (<>
                                    <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                        <CommentInput
                                            taskId={taskId}
                                            currentTime={0}
                                            currentTimestamp={`Thumbnail #${currentNumber}`}
                                            authorId={user?.id ? String(user.id) : 'guest'}
                                            authorName={user?.name || 'Client'}
                                            onSubmit={handleCommentSubmit}
                                            onCancel={() => setShowCommentInput(false)}
                                            isExpanded={showCommentInput}
                                            onToggleExpand={() => setShowCommentInput(true)}
                                        />
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 review-scrollbar min-h-0">
                                        {comments.length === 0 ? (
                                            <div className="text-center py-12 text-[var(--review-text-muted)]">
                                                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                                <p className="text-sm">No comments yet</p>
                                                <p className="text-xs mt-1 opacity-70">Add a comment to leave feedback</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {comments.map(comment => (
                                                    <div key={comment.id}>
                                                        <ReviewCommentCard
                                                            comment={comment}
                                                            onResolve={(id, resolved) =>
                                                                setComments(prev => prev.map(c => c.id === id ? { ...c, resolved } : c))
                                                            }
                                                            onDelete={(id) =>
                                                                setComments(prev => prev.filter(c => c.id !== id))
                                                            }
                                                            onTimestampClick={() => {}}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>)}

                                {/* ── TITLES TAB ── */}
                                {sidebarTab === 'titles' && (
                                    <div className="flex-1 overflow-y-auto review-scrollbar min-h-0">
                                        {(['titles', 'descriptions'] as const).map(type => {
                                            const currentList = type === 'titles' ? postingTitles : postingDescriptions;
                                            const cap = CAPS[type];
                                            const atCap = currentList.length >= cap;
                                            const labels = {
                                                titles:       { singular: 'title',       placeholder: 'Add a title…'       },
                                                descriptions: { singular: 'description', placeholder: 'Add a description…' },
                                            };
                                            const { singular, placeholder } = labels[type];

                                            return (
                                                <div key={type} className="border-b border-[var(--review-border)] last:border-0 pb-4 mb-2 last:mb-0">
                                                    {/* Section header + input */}
                                                    <div className="p-3 pb-1 space-y-2 sticky top-0 bg-[var(--review-bg-secondary)] z-10 border-b border-[var(--review-border)]/50">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold text-white capitalize">{type}</span>
                                                            <span className={`text-[10px] font-medium ${atCap ? 'text-red-400' : 'text-[var(--review-text-muted)]'}`}>
                                                                {currentList.length}/{cap}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1.5 pb-2">
                                                            <Input
                                                                value={newTexts[type]}
                                                                onChange={e => setNewTexts(prev => ({ ...prev, [type]: e.target.value }))}
                                                                placeholder={atCap ? `Max ${cap} ${singular}s reached` : placeholder}
                                                                disabled={atCap}
                                                                className="flex-1 text-xs h-8 bg-[var(--review-bg-tertiary)] border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] disabled:opacity-40"
                                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(type); } }}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                disabled={atCap || !newTexts[type].trim()}
                                                                onClick={() => addItem(type)}
                                                                className="h-8 px-2.5 bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white shrink-0"
                                                            >
                                                                <Plus className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* List items */}
                                                    <div className="px-3 space-y-2 mt-2">
                                                        {currentList.length === 0 ? (
                                                            <div className="text-center py-4 text-[var(--review-text-muted)]">
                                                                <p className="text-xs opacity-70">No {singular}s yet</p>
                                                            </div>
                                                        ) : currentList.map(item => (
                                                            <div key={item.id} className="group rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] p-2.5">
                                                                {editingId === item.id ? (
                                                                    <div className="space-y-1.5">
                                                                        <Input
                                                                            value={editingText}
                                                                            onChange={e => setEditingText(e.target.value)}
                                                                            className="text-xs h-8 bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white"
                                                                            autoFocus
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter') commitEdit(type);
                                                                                if (e.key === 'Escape') { setEditingId(null); setEditingText(''); }
                                                                            }}
                                                                        />
                                                                        <div className="flex gap-1">
                                                                            <Button size="sm" onClick={() => commitEdit(type)} className="h-6 px-2 text-[10px] bg-[var(--review-status-approved)] text-white">Save</Button>
                                                                            <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingText(''); }} className="h-6 px-2 text-[10px] text-[var(--review-text-muted)]">Cancel</Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-start gap-2">
                                                                        <p className="flex-1 text-xs text-[var(--review-text-secondary)] leading-relaxed break-words min-w-0">{item.text}</p>
                                                                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                onClick={() => startEdit(item.id, item.text)}
                                                                                className="p-1 rounded hover:bg-white/10 text-[var(--review-text-muted)] hover:text-white transition-colors"
                                                                                title={`Edit ${singular}`}
                                                                            >
                                                                                <PenLine className="h-3 w-3" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => deleteItem(type, item.id)}
                                                                                disabled={type === 'titles' && userRole === 'client' && currentList.length <= 1}
                                                                                className="p-1 rounded hover:bg-red-500/20 text-[var(--review-text-muted)] hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                title={`Delete ${singular}`}
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ── ACTION FOOTER ── */}
                                <div
                                    className="p-4 pb-6 border-t border-[var(--review-border)] flex flex-col gap-2.5 flex-shrink-0"
                                    style={{ background: 'var(--review-bg-secondary)' }}
                                >
                                    <Button
                                        size="sm"
                                        className="w-full bg-[var(--review-status-approved)] hover:bg-[var(--review-status-approved)]/90 text-white h-9 text-xs font-medium"
                                        onClick={handleApproveClick}
                                        disabled={savingFeedback || unresolvedCount > 0}
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                        Approve Final
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="w-full bg-red-500 hover:bg-red-600 text-white h-9 text-xs font-medium"
                                        onClick={handleRequestRevisionsClick}
                                        disabled={savingFeedback || unresolvedCount === 0}
                                    >
                                        {savingFeedback ? (
                                            <>
                                                <div className="h-3.5 w-3.5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <MessageSquare className="h-3.5 w-3.5 mr-2 text-white" />
                                                Request Revisions{unresolvedCount > 0 ? ` (${unresolvedCount})` : ''}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
}