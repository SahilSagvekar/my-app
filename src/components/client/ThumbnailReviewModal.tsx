'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
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

    // Versions of the current file (same name/folder, different versions)
    const versions = useMemo(() => {
        if (!currentFile) return [];
        return allFiles
            .filter(f => f.folderType === currentFile.folderType)
            .sort((a, b) => (b.version || 1) - (a.version || 1));
    }, [currentFile, allFiles]);

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
            version: currentFile?.version || 1,
        };

        setComments(prev => [newComment, ...prev]);
        setShowCommentInput(false);
        toast.success('Comment added locally. Submit "Request Revisions" to save.');
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
        const link = document.createElement('a');
        link.href = currentFile.downloadUrl || currentFile.url;
        link.setAttribute('download', currentFile.name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                                            {currentFile.folderType} v{currentFile.version || 1}
                                        </Badge>
                                        <span className="text-xs text-zinc-500">{currentFile.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
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
                                    Approve
                                </Button>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Image Viewer */}
                            <div className="flex-1 relative bg-black flex items-center justify-center p-8 overflow-auto">
                                <div className="relative group max-w-full max-h-full">
                                    <img
                                        src={currentFile.url}
                                        alt={currentFile.name}
                                        className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                                    />
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

                                {/* Version Switcher (Floating Bottom) */}
                                {versions.length > 1 && (
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">Versions</span>
                                        {versions.map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => setCurrentFile(v)}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${currentFile.id === v.id
                                                    ? 'bg-purple-600 text-white'
                                                    : 'text-zinc-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                V{v.version || 1}
                                            </button>
                                        ))}
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
                                                currentTimestamp="0:00"
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
