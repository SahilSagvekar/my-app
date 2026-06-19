'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Clock,
    ArrowLeft,
    Maximize,
    ChevronLeft,
    ChevronRight,
    Plus,
    LayoutGrid,
    Check,
    PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { ReviewCommentCard, CommentInput } from '../review';
import { ReviewComment, ReviewStatus } from '../review/types';
import { useAuth } from '../auth/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

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
    userRole?: 'client' | 'qc';
    // 🔥 Multi-item posting content lists
    postingTitles?: { id: string; text: string }[];
    postingDescriptions?: { id: string; text: string }[];
    postingTags?: { id: string; text: string }[];
    onPostingTitlesChange?: (items: { id: string; text: string }[]) => void;
    onPostingDescriptionsChange?: (items: { id: string; text: string }[]) => void;
    onPostingTagsChange?: (items: { id: string; text: string }[]) => void;
}

// 🔥 Posting-content tab panel for the thumbnail review modal
type ThumbPostingTab = 'comments' | 'titles' | 'descriptions' | 'tags';
interface ThumbPostingPanelProps {
    userRole: 'client' | 'qc';
    postingTitles: { id: string; text: string }[];
    postingDescriptions: { id: string; text: string }[];
    postingTags: { id: string; text: string }[];
    onPostingTitlesChange?: (items: { id: string; text: string }[]) => void;
    onPostingDescriptionsChange?: (items: { id: string; text: string }[]) => void;
    onPostingTagsChange?: (items: { id: string; text: string }[]) => void;
}
function ThumbPostingPanel({
    userRole,
    postingTitles,
    postingDescriptions,
    postingTags,
    onPostingTitlesChange,
    onPostingDescriptionsChange,
    onPostingTagsChange,
}: ThumbPostingPanelProps) {
    const [thumbTab, setThumbTab] = React.useState<ThumbPostingTab>('comments');
    const [thumbNewText, setThumbNewText] = React.useState('');
    const [thumbEditId, setThumbEditId] = React.useState<string | null>(null);
    const [thumbEditText, setThumbEditText] = React.useState('');

    const CAPS = { titles: 3, descriptions: 3, tags: 10 };
    const list = thumbTab === 'titles' ? postingTitles : thumbTab === 'descriptions' ? postingDescriptions : thumbTab === 'tags' ? postingTags : [];
    const setList = thumbTab === 'titles' ? onPostingTitlesChange : thumbTab === 'descriptions' ? onPostingDescriptionsChange : thumbTab === 'tags' ? onPostingTagsChange : undefined;
    const cap = thumbTab !== 'comments' ? CAPS[thumbTab as Exclude<ThumbPostingTab, 'comments'>] : 0;
    const atCap = list.length >= cap;
    const singular = thumbTab === 'titles' ? 'title' : thumbTab === 'descriptions' ? 'description' : 'tag';

    const addItem = () => {
        if (!setList || !thumbNewText.trim() || atCap) return;
        setList([...list, { id: `${Date.now()}-${Math.random()}`, text: thumbNewText.trim() }]);
        setThumbNewText('');
    };
    const deleteItem = (id: string) => {
        if (!setList) return;
        if (thumbTab === 'titles' && userRole === 'client' && list.length <= 1) return;
        setList(list.filter(i => i.id !== id));
    };
    const commitEdit = () => {
        if (!setList || !thumbEditId) return;
        const text = thumbEditText.trim();
        if (text) setList(list.map(i => i.id === thumbEditId ? { ...i, text } : i));
        setThumbEditId(null); setThumbEditText('');
    };

    return (
        <div className="flex-shrink-0 border-b border-white/10 bg-[#1a1a1a]">
            <div className="flex border-b border-white/10">
                {(['comments', 'titles', 'descriptions', 'tags'] as ThumbPostingTab[]).map(tab => (
                    <button key={tab} onClick={() => { setThumbTab(tab); setThumbNewText(''); setThumbEditId(null); }}
                        className={`flex-1 py-2 text-[10px] font-semibold capitalize transition-colors ${thumbTab === tab ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {tab === 'titles' ? `Titles${postingTitles.length ? ` (${postingTitles.length})` : ''}`
                            : tab === 'descriptions' ? `Desc${postingDescriptions.length ? ` (${postingDescriptions.length})` : ''}`
                            : tab === 'tags' ? `Tags${postingTags.length ? ` (${postingTags.length})` : ''}`
                            : 'Comments'}
                    </button>
                ))}
            </div>
            {thumbTab !== 'comments' && (
                <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex gap-1.5">
                        <Input value={thumbNewText} onChange={e => setThumbNewText(e.target.value)}
                            placeholder={atCap ? `Max ${cap} ${singular}s` : `Add a ${singular}…`}
                            disabled={atCap}
                            className="flex-1 text-xs h-7 bg-[#141414] border-white/10 text-white placeholder:text-zinc-600 disabled:opacity-40"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                        />
                        <Button size="sm" disabled={atCap || !thumbNewText.trim()} onClick={addItem}
                            className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white shrink-0">
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                    {list.map(item => (
                        <div key={item.id} className="group flex items-start gap-2 rounded border border-white/10 bg-[#141414] px-2.5 py-2">
                            {thumbEditId === item.id ? (
                                <div className="flex-1 flex gap-1">
                                    <Input value={thumbEditText} onChange={e => setThumbEditText(e.target.value)} autoFocus
                                        className="flex-1 text-xs h-7 bg-[#0d0d0d] border-white/10 text-white"
                                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setThumbEditId(null); setThumbEditText(''); } }}
                                    />
                                    <Button size="sm" onClick={commitEdit} className="h-7 px-2 bg-green-600 text-white text-[10px]">Save</Button>
                                </div>
                            ) : (
                                <>
                                    <p className="flex-1 text-xs text-zinc-300 leading-relaxed break-words min-w-0">{item.text}</p>
                                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setThumbEditId(item.id); setThumbEditText(item.text); }}
                                            className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
                                            <PenLine className="h-3 w-3" />
                                        </button>
                                        <button onClick={() => deleteItem(item.id)}
                                            disabled={thumbTab === 'titles' && userRole === 'client' && list.length <= 1}
                                            className="p-0.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {list.length === 0 && (
                        <p className="text-[11px] text-zinc-600 text-center py-2">No {singular}s yet</p>
                    )}
                </div>
            )}
        </div>
    );
}

export function ThumbnailReviewModal({
    open,
    onOpenChange,
    file,
    allFiles,
    taskId,
    taskTitle,
    onApprove,
    onRequestRevisions,
    userRole = 'client',
    postingTitles = [],
    postingDescriptions = [],
    postingTags = [],
    onPostingTitlesChange,
    onPostingDescriptionsChange,
    onPostingTagsChange,
}: ThumbnailReviewModalProps) {
    const { user } = useAuth();

    // UI State
    const [currentFile, setCurrentFile] = useState<TaskFile | null>(null);
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [savingFeedback, setSavingFeedback] = useState(false);
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);
    const [reviewStatus, setReviewStatus] = useState<ReviewStatus['value']>('needs_review');
    const [viewMode, setViewMode] = useState<'single' | 'gallery'>('gallery');
    const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

    // Ordered thumbnails in this folder
    const orderedThumbnails = useMemo(() => {
        return allFiles
            .filter(f => f.folderType === (file?.folderType || 'thumbnails'))
            .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    }, [file, allFiles]);

    // Current thumbnail index (1-based)
    const currentNumber = useMemo(() => {
        if (!currentFile) return 1;
        return orderedThumbnails.findIndex(t => t.id === currentFile.id) + 1;
    }, [currentFile, orderedThumbnails]);

    // Initialize
    useEffect(() => {
        if (file) {
            setCurrentFile(file);
            setComments([]);
            setShowCommentInput(false);
            setReviewStatus('needs_review');

            // Load existing feedback if available
            fetchFeedback(file.id);
        }
    }, [file]);

    const fetchFeedback = async (fileId: string) => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`);
            if (res.ok) {
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
            }
        } catch (err) {
            console.error('Error fetching feedback:', err);
        }
    };

    const handleCommentSubmit = async (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => {
        const newComment: ReviewComment = {
            ...comment,
            id: Date.now().toString(),
            createdAt: new Date(),
            version: currentNumber, // Use the position number instead of version for thumbnails
        };

        setComments(prev => [newComment, ...prev]);
        setShowCommentInput(false);
    };

    const handleApproveClick = async () => {
        if (!currentFile) return;

        setShowApprovalSuccess(true);
        onApprove(currentFile);

        setTimeout(() => {
            setShowApprovalSuccess(false);
            onOpenChange(false);
        }, 2000);
    };

    const handleRequestRevisionsClick = async () => {
        if (!currentFile || comments.length === 0) {
            if (comments.length === 0) toast.error('Please add at least one comment for revisions');
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
                body: JSON.stringify({
                    feedbackItems,
                    createdBy: user?.id || 0,
                }),
            });

            if (!res.ok) throw new Error('Failed to save feedback');

            setShowRevisionSuccess(true);
            onRequestRevisions(currentFile, feedbackItems);

            setTimeout(() => {
                setShowRevisionSuccess(false);
                onOpenChange(false);
            }, 2000);
        } catch (err) {
            console.error('Error requesting revisions:', err);
            toast.error('Failed to save feedback');
        } finally {
            setSavingFeedback(false);
        }
    };

    const handleDownload = () => {
        if (!currentFile) return;
        // Use download API for S3 files (presigned URL with Content-Disposition: attachment)
        const isS3 = currentFile.url?.includes('amazonaws.com') || currentFile.url?.includes('r2.cloudflarestorage.com') || currentFile.url?.includes('r2.dev');
        if (isS3) {
            window.open(`/api/files/${currentFile.id}/download`, '_blank');
            toast.success('Download started');
        } else if (currentFile.downloadUrl) {
            window.open(currentFile.downloadUrl, '_blank');
        } else {
            window.open(currentFile.url, '_blank');
        }
    };

    if (!currentFile) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="!fixed !inset-0 !z-50 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !overflow-hidden !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none fullscreen-dialog review-modal"
            >
                <TooltipProvider delayDuration={300}>
                    <div className="sr-only">
                        <DialogTitle>Review {currentFile.name}</DialogTitle>
                        <DialogDescription>Review and provide feedback on this image.</DialogDescription>
                    </div>

                    <div className="relative w-full h-full flex flex-col bg-[#0d0d0d]">
                        {/* Success States */}
                        {showApprovalSuccess && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-300">
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
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-300">
                                <Card className="bg-orange-900/50 border-orange-500/50 backdrop-blur-xl">
                                    <CardContent className="p-8 text-center">
                                        <MessageSquare className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                                        <h3 className="text-xl font-medium text-orange-100 mb-2">Revisions Requested</h3>
                                        <p className="text-orange-300/80">{comments.length} comments saved to task.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Header */}
                        <div className="flex-shrink-0 px-6 py-4 bg-[#1a1a1a] border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenChange(false)}
                                    className="text-white hover:bg-white/10"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back
                                </Button>
                                <div className="h-6 w-px bg-white/10" />
                                <div>
                                    <h1 className="text-lg font-medium text-white">{taskTitle}</h1>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Badge variant="secondary" className="bg-purple-600 text-white border-none">
                                            {currentFile.folderType} #{currentNumber}
                                        </Badge>
                                        <span className="text-xs text-zinc-500">{currentFile.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode(viewMode === 'gallery' ? 'single' : 'gallery')}
                                    className="text-zinc-400 hover:text-white"
                                >
                                    <LayoutGrid className="h-4 w-4 mr-2" />
                                    {viewMode === 'gallery' ? 'Review Single' : 'View Gallery'}
                                </Button>
                                <div className="h-6 w-px bg-white/10 mx-2" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDownload}
                                    className="text-zinc-400 hover:text-white"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                </Button>
                                <div className="h-6 w-px bg-white/10 mx-2" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRequestRevisionsClick}
                                    disabled={savingFeedback || comments.length === 0}
                                    className="border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-white"
                                >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Request Revisions
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleApproveClick}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approve Final
                                </Button>
                            </div>
                        </div>

                        {/* Posting Content Tab Bar */}
                        <ThumbPostingPanel
                            userRole={userRole}
                            postingTitles={postingTitles}
                            postingDescriptions={postingDescriptions}
                            postingTags={postingTags}
                            onPostingTitlesChange={onPostingTitlesChange}
                            onPostingDescriptionsChange={onPostingDescriptionsChange}
                            onPostingTagsChange={onPostingTagsChange}
                        />

                        {/* Main Content Area */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Image Viewer / Gallery */}
                            <div className="flex-1 relative bg-black overflow-auto p-8">
                                {viewMode === 'gallery' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto items-start">
                                        {orderedThumbnails.map((t, idx) => (
                                            <div
                                                key={t.id}
                                                className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer ${currentFile.id === t.id ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-white/5 hover:border-white/20'
                                                    }`}
                                                onClick={() => {
                                                    setCurrentFile(t);
                                                    setViewMode('single');
                                                }}
                                            >
                                                <div className="aspect-video relative">
                                                    <img src={t.url} alt={t.name} className="w-full h-full object-cover" />
                                                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                                                        <span className="text-white font-black text-sm">#{idx + 1}</span>
                                                    </div>

                                                    {/* Overlays on hover */}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Button variant="secondary" size="sm" className="bg-white text-black hover:bg-zinc-200">
                                                            Review Details
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-[#1a1a1a] border-t border-white/10 flex items-center justify-between">
                                                    <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[150px]">{t.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {comments.some(c => c.version === (idx + 1)) && (
                                                            <Badge className="bg-orange-500/20 text-orange-500 text-[9px] border-none flex items-center gap-1">
                                                                <MessageSquare className="h-2.5 w-2.5" />
                                                                {comments.filter(c => c.version === (idx + 1)).length}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        <div className="relative group max-w-full max-h-full">
                                            <img
                                                src={currentFile.url}
                                                alt={currentFile.name}
                                                className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                                            />
                                            <div className="absolute top-4 left-4 bg-purple-600 text-white px-4 py-1.5 rounded-lg font-black text-lg shadow-xl">
                                                #{currentNumber}
                                            </div>
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="bg-black/50 hover:bg-black/80 text-white border-none"
                                                    onClick={() => window.open(currentFile.url, '_blank')}
                                                >
                                                    <Maximize className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Simple Numbered Switcher (Floating Bottom) */}
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">Thumbnails</span>
                                            {orderedThumbnails.map((t, idx) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setCurrentFile(t)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${currentFile.id === t.id
                                                        ? 'bg-purple-600 text-white'
                                                        : 'text-zinc-400 hover:bg-white/10'
                                                        }`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            ))}
                                            <div className="h-4 w-px bg-white/10 mx-1" />
                                            <button
                                                onClick={() => setViewMode('gallery')}
                                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sidebar */}
                            <div className="w-[380px] flex-shrink-0 bg-[#1a1a1a] border-l border-white/10 flex flex-col">
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-purple-500" />
                                        Review Activity
                                        <Badge variant="secondary" className="bg-zinc-800 text-[10px] h-5">
                                            {comments.length}
                                        </Badge>
                                    </h2>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4 review-scrollbar">
                                    {/* Action Bar */}
                                    {!showCommentInput ? (
                                        <Button
                                            className="w-full bg-[#262626] hover:bg-[#2d2d2d] border border-white/5 text-zinc-400 hover:text-white justify-start"
                                            onClick={() => setShowCommentInput(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add feedback...
                                        </Button>
                                    ) : (
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <CommentInput
                                                taskId={taskId}
                                                currentTime={0}
                                                currentTimestamp={`Thumbnail #${currentNumber}`}
                                                authorId={user?.id || 'guest'}
                                                authorName={user?.name || 'Client'}
                                                onSubmit={handleCommentSubmit}
                                                onCancel={() => setShowCommentInput(false)}
                                                isExpanded={true}
                                            />
                                        </div>
                                    )}

                                    {/* Comments List */}
                                    <div className="space-y-4 pb-12">
                                        {comments.length === 0 ? (
                                            <div className="text-center py-12">
                                                <div className="w-12 h-12 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <MessageSquare className="h-6 w-6 text-zinc-600" />
                                                </div>
                                                <p className="text-zinc-500 text-sm">No comments yet</p>
                                                <p className="text-zinc-600 text-xs mt-1">Be the first to provide feedback</p>
                                            </div>
                                        ) : (
                                            comments.map((comment) => (
                                                <ReviewCommentCard
                                                    key={comment.id}
                                                    comment={comment}
                                                    onResolve={(id, resolved) => {
                                                        setComments(prev => prev.map(c => c.id === id ? { ...c, resolved } : c));
                                                    }}
                                                    onDelete={(id) => {
                                                        setComments(prev => prev.filter(c => c.id !== id));
                                                    }}
                                                    onTimestampClick={() => { }}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
}