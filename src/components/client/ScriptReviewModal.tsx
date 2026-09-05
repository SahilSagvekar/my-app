'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { X, CheckCircle2, MessageSquare, ArrowLeft, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ReviewCommentCard, CommentInput } from '../review';
import { ReviewComment } from '../review/types';
import { useAuth } from '../auth/AuthContext';
import { useHideFeedbackWidgetWhileOpen } from '@/hooks/useFeedbackWidgetVisibility';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

/* ─── Types ────────────────────────────────────────────────────── */
interface ScriptVersion {
    number: number;
    content: string;
    createdAt: string;
    editedBy?: { id: number | string; name: string; role?: string };
}

interface ScriptReviewPayload {
    kind: 'shoot-script';
    scriptId?: string;
    shootTaskId?: string;
    versions: ScriptVersion[];
}

function parseTextContent(raw: string): ScriptReviewPayload {
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.kind === 'shoot-script' && Array.isArray(parsed.versions)) {
                return parsed;
            }
        } catch {
            // Legacy plain-text value — fall through and treat it as version 1.
        }
    }
    return {
        kind: 'shoot-script',
        versions: raw ? [{ number: 1, content: raw, createdAt: new Date().toISOString() }] : [],
    };
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface ScriptReviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: string;
    taskTitle: string;
    textContent: string;
    onApprove: () => void | Promise<void>;
    onRequestRevisions: (feedbackItems: { feedback: string }[]) => void | Promise<void>;
    userRole?: 'client' | 'qc';
    // Pure playback mode — hides the comments sidebar, editing, and
    // approve/reject actions. Used when reopening something already sent back.
    readOnly?: boolean;
}

/* ─── Component ─────────────────────────────────────────────────── */
export function ScriptReviewModal({
    open,
    onOpenChange,
    taskId,
    taskTitle,
    textContent,
    onApprove,
    onRequestRevisions,
    userRole = 'client',
    readOnly = false,
}: ScriptReviewModalProps) {
    const { user } = useAuth();
    useHideFeedbackWidgetWhileOpen(open);

    /* ── Script content / version state ── */
    const [versions, setVersions] = useState<ScriptVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
    const [draft, setDraft] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContent = useRef('');

    /* ── Comments / sidebar state ── */
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [savingFeedback, setSavingFeedback] = useState(false);
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);

    const latestVersion = versions.length ? versions[versions.length - 1] : null;
    const isViewingLatest = selectedVersion === null || selectedVersion === latestVersion?.number;
    const canEdit = !readOnly && (userRole === 'client' || userRole === 'qc') && isViewingLatest;
    const unresolvedCount = comments.filter(c => !c.resolved).length;

    /* ── Initialise on open ── */
    useEffect(() => {
        if (!open) return;
        const parsed = parseTextContent(textContent);
        setVersions(parsed.versions);
        const latest = parsed.versions[parsed.versions.length - 1];
        setDraft(latest?.content || '');
        lastSavedContent.current = latest?.content || '';
        setSelectedVersion(null);
        setComments([]);
        setShowCommentInput(false);
        setSaveStatus('idle');
        fetchFeedback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, taskId]);

    /* ── Data fetching ── */
    const fetchFeedback = async () => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.feedback) {
                const scriptFeedback = data.feedback
                    .filter((fb: any) => (fb.folderType || '') === 'script')
                    .filter((fb: any) => userRole !== 'client' || String(fb.user?.id || 0) === String(user?.id || 0))
                    .map((fb: any) => ({
                        id: fb.id,
                        taskId,
                        authorId: String(fb.user?.id || 0),
                        authorName: fb.user?.name || 'Member',
                        content: fb.feedback,
                        timestamp: '0:00',
                        timestampSeconds: 0,
                        category: fb.category ? fb.category.split(',') : ['other'],
                        createdAt: new Date(fb.createdAt),
                        resolved: fb.status === 'resolved',
                        voiceUrl: fb.voiceUrl || undefined,
                        voiceDurationSec: fb.voiceDurationSec || undefined,
                        attachments: fb.attachments || undefined,
                    }));
                setComments(scriptFeedback);
            }
        } catch (err) {
            console.error('Error fetching script feedback:', err);
        }
    };

    /* ── Autosave ── */
    const saveDraft = useCallback(async (content: string) => {
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/tasks/${taskId}/script-review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content }),
            });
            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            if (data.script?.versions) {
                setVersions(data.script.versions);
            }
            lastSavedContent.current = content;
            setSaveStatus('saved');
        } catch (err) {
            console.error('Error autosaving script:', err);
            setSaveStatus('error');
            toast.error('Could not save your edit — check your connection');
        }
    }, [taskId]);

    const handleDraftChange = (value: string) => {
        setDraft(value);
        if (!canEdit) return;
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
            if (value !== lastSavedContent.current) saveDraft(value);
        }, AUTOSAVE_DEBOUNCE_MS);
    };

    // Flush a pending autosave immediately (e.g. on close) so an edit made
    // just before closing isn't lost to the debounce.
    useEffect(() => {
        return () => {
            if (autosaveTimer.current) {
                clearTimeout(autosaveTimer.current);
                if (canEdit && draft !== lastSavedContent.current) saveDraft(draft);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    /* ── Version selector ── */
    const handleSelectVersion = (numberStr: string) => {
        const number = Number(numberStr);
        const version = versions.find(v => v.number === number);
        if (!version) return;
        setSelectedVersion(number === latestVersion?.number ? null : number);
        if (number !== latestVersion?.number) setDraft(version.content);
        else setDraft(lastSavedContent.current);
    };

    const handleRestoreVersion = () => {
        if (selectedVersion === null) return;
        const version = versions.find(v => v.number === selectedVersion);
        if (!version) return;
        setSelectedVersion(null);
        setDraft(version.content);
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        saveDraft(version.content);
        toast.success(`Restored version ${version.number} as the new draft`);
    };

    const displayedContent = isViewingLatest ? draft : (versions.find(v => v.number === selectedVersion)?.content || '');

    /* ── Comment handlers ── */
    const handleCommentSubmit = async (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => {
        const newComment: ReviewComment = { ...comment, id: Date.now().toString(), createdAt: new Date() };
        setComments(prev => [newComment, ...prev]);
        setShowCommentInput(false);
    };

    /* ── Approval / revision handlers ── */
    const handleApproveClick = async () => {
        setShowApprovalSuccess(true);
        await onApprove();
        setTimeout(() => { setShowApprovalSuccess(false); onOpenChange(false); }, 2000);
    };

    const handleRequestRevisionsClick = async () => {
        if (unresolvedCount === 0) {
            toast.error('Please add at least one comment for revisions');
            return;
        }
        try {
            setSavingFeedback(true);
            const feedbackItems = comments
                .filter(c => !c.resolved)
                .map(c => ({
                    folderType: 'script',
                    feedback: c.content,
                    category: Array.isArray(c.category) ? c.category.join(',') : c.category,
                    timestamp: '0:00',
                }));
            const res = await fetch(`/api/tasks/${taskId}/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ feedbackItems, createdBy: user?.id || 0 }),
            });
            if (!res.ok) throw new Error('Failed to save feedback');
            setShowRevisionSuccess(true);
            await onRequestRevisions(feedbackItems);
            setTimeout(() => { setShowRevisionSuccess(false); onOpenChange(false); }, 2000);
        } catch (err) {
            console.error('Error requesting script revisions:', err);
            toast.error('Failed to save feedback');
        } finally {
            setSavingFeedback(false);
        }
    };

    const saveStatusLabel = useMemo(() => {
        switch (saveStatus) {
            case 'saving': return 'Saving…';
            case 'saved': return 'Saved';
            case 'error': return 'Save failed';
            default: return null;
        }
    }, [saveStatus]);

    /* ─────────────────────────────────────────────────────────── */
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!fixed !inset-0 !z-50 !w-screen !h-screen !max-w-none !max-h-none !m-0 !p-0 !overflow-hidden !transform-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none fullscreen-dialog review-modal">
                <TooltipProvider delayDuration={300}>
                    <div className="sr-only">
                        <DialogTitle>Review script — {taskTitle}</DialogTitle>
                        <DialogDescription>Review, edit, and comment on this script.</DialogDescription>
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
                                        <h1 className="text-lg font-medium text-white flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-purple-400" />
                                            {taskTitle}
                                        </h1>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge className="bg-purple-600/80 text-white text-xs border-none capitalize">Script</Badge>
                                            <span className="text-sm text-[var(--review-text-muted)]">
                                                {versions.length} version{versions.length !== 1 ? 's' : ''}
                                            </span>
                                            {saveStatusLabel && (
                                                <span className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-[var(--review-text-muted)]'}`}>
                                                    &bull; {saveStatusLabel}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => onOpenChange(false)}
                                        className="text-black hover:text-black bg-red-500 hover:bg-red-600 h-8 w-8 p-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* ── BODY ── */}
                        <div className="flex-1 flex overflow-hidden min-h-0">

                            {/* ── SCRIPT AREA ── */}
                            <div className="flex-1 flex flex-col overflow-hidden p-8">
                                <div className="max-w-[720px] w-full mx-auto flex-1 flex flex-col min-h-0">
                                    <div
                                        className="flex-1 flex flex-col min-h-0 rounded-2xl border overflow-hidden"
                                        style={{
                                            background: 'var(--review-bg-elevated)',
                                            borderColor: 'var(--review-border)',
                                            boxShadow: '0 24px 60px -28px rgba(0, 0, 0, 0.7)',
                                        }}
                                    >
                                        {/* Panel header — version control lives here, not as a caption above the page */}
                                        <div
                                            className="flex items-center justify-between gap-3 px-8 py-4 border-b flex-shrink-0"
                                            style={{ borderColor: 'var(--review-border)' }}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {(() => {
                                                    const shownVersion = isViewingLatest ? latestVersion : versions.find(v => v.number === selectedVersion);
                                                    const initial = shownVersion?.editedBy?.name?.trim()?.[0]?.toUpperCase();
                                                    return initial ? (
                                                        <div
                                                            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                                                            style={{ background: 'var(--review-accent-purple)', color: '#fff' }}
                                                        >
                                                            {initial}
                                                        </div>
                                                    ) : null;
                                                })()}
                                                {versions.length > 1 ? (
                                                    <Select
                                                        value={String(selectedVersion ?? latestVersion?.number ?? '')}
                                                        onValueChange={handleSelectVersion}
                                                    >
                                                        <SelectTrigger
                                                            className="h-auto w-auto gap-1.5 border-0 bg-transparent p-0 text-sm font-medium shadow-none hover:opacity-80 focus:ring-0 focus-visible:ring-0"
                                                            style={{ color: 'var(--review-text-secondary)' }}
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {[...versions].reverse().map(v => (
                                                                <SelectItem key={v.number} value={String(v.number)}>
                                                                    Version {v.number}{v.number === latestVersion?.number ? ' · latest' : ''}{v.editedBy?.name ? ` · ${v.editedBy.name}` : ''} · {new Date(v.createdAt).toLocaleDateString()}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <span className="text-sm font-medium truncate" style={{ color: 'var(--review-text-secondary)' }}>
                                                        {latestVersion?.editedBy?.name ? `Written by ${latestVersion.editedBy.name}` : taskTitle}
                                                    </span>
                                                )}
                                            </div>
                                            {!isViewingLatest && (
                                                <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={handleRestoreVersion}>
                                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                    Restore this version
                                                </Button>
                                            )}
                                        </div>

                                        {/* Page */}
                                        <Textarea
                                            value={displayedContent}
                                            onChange={(e) => canEdit && handleDraftChange(e.target.value)}
                                            readOnly={!canEdit}
                                            placeholder={canEdit ? 'Write or paste the script here…' : '(No script content yet)'}
                                            className="flex-1 w-full resize-none border-0 rounded-none bg-transparent focus-visible:ring-0 shadow-none px-10 py-8"
                                            style={{
                                                fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
                                                fontSize: '16px',
                                                lineHeight: '1.85',
                                                color: 'var(--review-text-primary)',
                                                caretColor: 'var(--review-accent-purple)',
                                            }}
                                        />
                                    </div>

                                    {!isViewingLatest && (
                                        <p className="mt-3 text-xs text-center flex-shrink-0" style={{ color: 'var(--review-text-muted)' }}>
                                            Viewing an older version, read-only — restore it to make it editable again.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ── SIDEBAR — hidden in read-only playback mode ── */}
                            {!readOnly && (
                            <div
                                className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l border-[var(--review-border)]"
                                style={{ background: 'var(--review-bg-secondary)', height: 'calc(100vh - 57px)' }}
                            >
                                <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                    <span className="text-[11px] font-semibold py-1.5 px-2 rounded-md bg-blue-500 text-white">
                                        Comments{comments.length ? ` (${comments.length})` : ''}
                                    </span>
                                </div>

                                <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                    <CommentInput
                                        taskId={taskId}
                                        currentTime={0}
                                        currentTimestamp={`Script v${latestVersion?.number || 1}`}
                                        authorId={user?.id ? String(user.id) : 'guest'}
                                        authorName={user?.name || 'Member'}
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
                            )}
                        </div>
                    </div>
                </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
}