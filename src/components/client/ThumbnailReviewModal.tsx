'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { E8Logo } from '../ui/E8Logo';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
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
    ListOrdered,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ImageIcon,
    Send,
    CheckSquare,
    Crop,
    Ban,
    Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ReviewCommentCard, CommentInput, ClientCommentsDropdown, ReviewModePills, ReviewDrawOverlay, captureFullFrameFromSource } from '../review';
import type { CommentInputHandle, ReviewMode } from '../review';
import { ImageCropDialog } from './ImageCropDialog';
import { ReviewComment } from '../review/types';
import { useAuth } from '../auth/AuthContext';
import { useHideFeedbackWidgetWhileOpen } from '@/hooks/useFeedbackWidgetVisibility';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ImageOrderModal } from './ImageOrderModal';
import { ImageOrderPopover } from './ImageOrderPopover';
import { sortTaskImages } from '@/lib/task-image-order';
import { FinalRevisionConfirmDialog } from './FinalRevisionConfirmDialog';

/* ─── Types ────────────────────────────────────────────────────── */
export interface TaskFile {
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
    replacedBy?: string;
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
    // `opts.sendToClient` (QC only): true = force into client review, false =
    // bypass it, undefined = keep the task's own client-review setting.
    onApprove: (file: TaskFile, opts?: { sendToClient?: boolean }) => void | Promise<void>;
    onRequestRevisions: (
        file: TaskFile,
        feedback: any[],
        options?: { finalRevision?: boolean }
    ) => void | Promise<void>;
    // Client portal only: shows a second "Final Revision" button next to "Send Back"
    // (the task skips client review after QC approves the fix).
    allowFinalRevision?: boolean;
    // QC: the client already used "Final Revision" — this task can't go back to the client.
    finalRevisionLocked?: boolean;
    onSwitchToVideo?: () => void;
    userRole?: 'client' | 'qc';
    imageLabel?: string;
    postingTitles?: { id: string; text: string }[];
    postingDescriptions?: { id: string; text: string }[];
    postingTags?: { id: string; text: string }[];
    onPostingTitlesChange?: (items: { id: string; text: string }[]) => void;
    onPostingDescriptionsChange?: (items: { id: string; text: string }[]) => void;
    onPostingTagsChange?: (items: { id: string; text: string }[]) => void;
    taskAttachments?: any;
    imageOrder?: string[];
    onImageOrderChange?: (newOrder: string[]) => void;
    // Pure playback mode — hides the entire sidebar (comments/titles tabs,
    // approve/reject actions). Used for the client's "Rejected" section.
    readOnly?: boolean;
    // QC screen only: name of the editor who made this task, shown in the top bar.
    editorName?: string;
    // Client's saved hashtag templates — offered as one-click tags and used to
    // seed the tag list when it is empty.
    templateHashtags?: string[];
    // Called after a reviewer crop saves, so the parent can patch its copy of
    // the task's files (old file goes inactive, the new version is added).
    onImageReplaced?: (oldFileId: string, newFile: TaskFile) => void;
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
    allowFinalRevision = false,
    finalRevisionLocked = false,
    onSwitchToVideo,
    userRole = 'client',
    imageLabel = 'Thumbnails',
    postingTitles = [],
    postingDescriptions = [],
    postingTags = [],
    onPostingTitlesChange,
    onPostingDescriptionsChange,
    onPostingTagsChange,
    taskAttachments,
    imageOrder: propImageOrder,
    onImageOrderChange,
    readOnly = false,
    editorName,
    templateHashtags,
    onImageReplaced,
}: ThumbnailReviewModalProps) {
    const { user } = useAuth();

    // Hide the floating "Report a Problem" widget while this full-screen
    // review is open — it otherwise floats on top of the Approve/Send Back
    // buttons.
    useHideFeedbackWidgetWhileOpen(open);

    /* ── UI state ── */
    const [currentFile, setCurrentFile] = useState<TaskFile | null>(null);
    const [comments, setComments] = useState<ReviewComment[]>([]);
    // Every client comment on this task's images, across all images and
    // versions (feeds the "Client comments — all versions" toolbar button).
    // Separate from `comments`, which only holds the opened file's thread.
    const [clientFeedback, setClientFeedback] = useState<ReviewComment[]>([]);
    const [showCommentInput, setShowCommentInput] = useState(true);
    const imageRef = useRef<HTMLImageElement>(null);
    const [savingFeedback, setSavingFeedback] = useState(false);
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showRevisionSuccess, setShowRevisionSuccess] = useState(false);

    // After approve / send-back the success screen shows for 2s and then closes
    // this window. The timer lives in a ref so it can be cancelled — otherwise
    // it fires later and closes whatever task the reviewer has opened in the
    // meantime. It's cancelled when the reviewed task changes or this
    // component unmounts, and the success overlays are cleared with it.
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
            setShowApprovalSuccess(false);
            setShowRevisionSuccess(false);
        };
    }, [taskId]);
    const scheduleCloseAfterSuccess = (clearOverlay: () => void) => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            closeTimerRef.current = null;
            clearOverlay();
            onOpenChange(false);
        }, 2000);
    };
    const [viewMode, setViewMode] = useState<'single' | 'gallery'>('gallery');
    const [showFinalRevisionConfirm, setShowFinalRevisionConfirm] = useState(false);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    // 🩹 CORS fallback — the single-image view loads with crossOrigin="anonymous"
    // so CommentInput can read the image onto a canvas for screenshot capture.
    // If that specific load fails (R2 not returning CORS headers for this
    // request, a transient network hiccup, etc.), retry the same URL without
    // crossOrigin so the client still sees the image — screenshot capture just
    // won't be available on this image until it loads cleanly again.
    const [imgCrossOriginFailed, setImgCrossOriginFailed] = useState(false);

    // Review tools (Draw / Voice / Attach) — same pills the video review uses.
    const commentInputRef = useRef<CommentInputHandle>(null);
    const imageStageRef = useRef<HTMLDivElement>(null);
    const [activeMode, setActiveMode] = useState<ReviewMode | null>(null);
    const [drawBaseUrl, setDrawBaseUrl] = useState<string | null>(null);
    const [drawBox, setDrawBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const [drawBoxEl, setDrawBoxEl] = useState<HTMLDivElement | null>(null);

    // Crop / aspect ratio
    const [showCrop, setShowCrop] = useState(false);
    const [cropSaving, setCropSaving] = useState(false);
    // Local copy of crops saved this session so the review reflects them
    // immediately, whether or not the parent patches its own file list.
    const [cropPatches, setCropPatches] = useState<{ oldId: string; file: TaskFile }[]>([]);
    const [orderPatch, setOrderPatch] = useState<Record<string, string>>({});

    // Fully rejecting an image: fileId → the saved rejection feedback row.
    const [rejections, setRejections] = useState<Record<string, { id: string; reason: string; content: string }>>({});
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);

    /* ── Sidebar tabs & 3-step state ── */
    type SidebarTab = 'comments' | 'titles' | 'thumbnails';
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('comments');

    const [okComments, setOkComments] = useState(false);
    const [okTitles, setOkTitles] = useState(false);
    const [okThumbnails, setOkThumbnails] = useState(false);
    const [confirmFinal, setConfirmFinal] = useState(false);

    const is3Step = imageLabel === 'Thumbnails';
    const totalSteps = is3Step ? 3 : 2;

    const allOthersApproved = is3Step
        ? (sidebarTab === 'comments' ? okTitles && okThumbnails :
           sidebarTab === 'titles' ? okComments && okThumbnails :
           okComments && okTitles)
        : (sidebarTab === 'comments' ? okTitles : okComments);

    const approveLabel = allOthersApproved ? 'Approve Final' : 'Approve';
    const currentStepNum = sidebarTab === 'comments' ? 1 : sidebarTab === 'titles' ? 2 : 3;
    const currentStepName = sidebarTab === 'comments' ? 'COMMENTS' : sidebarTab === 'titles' ? 'TITLES' : imageLabel.toUpperCase();
    const stepLabel = `STEP ${currentStepNum} OF ${totalSteps} — ${currentStepName}`;

    const handleStepApprove = () => {
        if (sidebarTab === 'comments') {
            setOkComments(true);
            if (!okTitles) {
                setSidebarTab('titles');
            } else if (is3Step && !okThumbnails) {
                setSidebarTab('thumbnails');
            } else {
                handleApproveClick();
            }
        } else if (sidebarTab === 'titles') {
            setOkTitles(true);
            if (is3Step && !okThumbnails) {
                setSidebarTab('thumbnails');
            } else if (!okComments) {
                setSidebarTab('comments');
            } else {
                handleApproveClick();
            }
        } else {
            setOkThumbnails(true);
            if (okComments && okTitles) {
                handleApproveClick();
            } else if (!okComments) {
                setSidebarTab('comments');
            } else {
                setSidebarTab('titles');
            }
        }
    };

    /* ── Titles / descriptions editing state ── */
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [newTexts, setNewTexts] = useState({ titles: '', descriptions: '', tags: '' });
    const CAPS = { titles: 3, descriptions: 3, tags: 10 };
    type PostingType = 'titles' | 'descriptions' | 'tags';

    /* ── Initial image order computation ── */
    const initialImageOrder = useMemo(() => {
        let base: string[] | undefined;
        if (Array.isArray(propImageOrder) && propImageOrder.length > 0) base = propImageOrder;
        else if (taskAttachments?.imageOrder && Array.isArray(taskAttachments.imageOrder)) {
            base = taskAttachments.imageOrder;
        }
        // Crops swap an image's ID — keep its position in a saved order.
        return base ? base.map(id => orderPatch[id] ?? id) : undefined;
    }, [propImageOrder, taskAttachments, orderPatch]);

    // allFiles + crops saved in this session (old file inactive, new added).
    const effectiveFiles = useMemo(() => {
        if (cropPatches.length === 0) return allFiles;
        const replacedBy = new Map(cropPatches.map(c => [c.oldId, c.file.id]));
        const merged = allFiles.map(f => replacedBy.has(f.id) ? { ...f, isActive: false, replacedBy: replacedBy.get(f.id) } : f);
        const have = new Set(merged.map(f => f.id));
        cropPatches.forEach(c => { if (!have.has(c.file.id)) merged.push(c.file); });
        return merged;
    }, [allFiles, cropPatches]);

    /* ── Ordered Thumbnails State ── */
    const [orderedThumbnails, setOrderedThumbnails] = useState<TaskFile[]>([]);

    // Per-image version history — each "slot" is one image position, walked
    // backward from its current active file through replacedBy links to
    // every file that ever occupied that slot. Lets the reviewer step back
    // to see the whole set as it looked at an earlier round, even though
    // each image was revised independently (image 3 might be on v2 while
    // the rest are still v1).
    const imageSlots = useMemo(() => {
        const folder = file?.folderType || 'thumbnails';
        const imagesInFolder = effectiveFiles.filter(f => f.folderType === folder);
        const predecessorOf = new Map<string, TaskFile>();
        imagesInFolder.forEach(f => {
            if (f.replacedBy) predecessorOf.set(f.replacedBy, f);
        });

        const activeFiles = imagesInFolder.filter(f => f.isActive !== false);
        const sortedActive = sortTaskImages(activeFiles, initialImageOrder);

        return sortedActive.map(activeFile => {
            const chain: TaskFile[] = [activeFile];
            let cur = activeFile;
            while (predecessorOf.has(cur.id)) {
                const prev = predecessorOf.get(cur.id)!;
                chain.unshift(prev);
                cur = prev;
            }
            return chain; // ordered v1 → current, one entry per revision
        });
    }, [effectiveFiles, file?.folderType, initialImageOrder]);

    // True latest version — independent of what's currently being viewed.
    const latestVersion = useMemo(() => {
        return imageSlots.reduce((max, chain) => Math.max(max, ...chain.map(f => f.version || 1)), 1);
    }, [imageSlots]);

    const [viewingVersion, setViewingVersion] = useState(() => latestVersion);

    useEffect(() => {
        // For each slot, show its own file at this version if it has one,
        // otherwise its latest-so-far (nothing changed for it after that).
        const resolved = imageSlots.map(chain => {
            let pick = chain[0];
            for (const f of chain) {
                if ((f.version || 1) <= viewingVersion) pick = f;
                else break;
            }
            return pick;
        });
        setOrderedThumbnails(resolved);
    }, [imageSlots, viewingVersion]);

    const handleReorderImages = async (newFiles: any[]) => {
        const typedFiles = newFiles as TaskFile[];
        setOrderedThumbnails(typedFiles);
        const newOrderIds = typedFiles.map(f => f.id);
        if (onImageOrderChange) {
            onImageOrderChange(newOrderIds);
        }
        try {
            setIsSavingOrder(true);
            const res = await fetch(`/api/tasks/${taskId}/image-order`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageOrder: newOrderIds }),
            });
            if (!res.ok) throw new Error('Failed to save image order');
            toast.success('Image order saved');
        } catch (err) {
            console.error('Error saving image order:', err);
            toast.error('Failed to save image order');
        } finally {
            setIsSavingOrder(false);
        }
    };

    const currentNumber = useMemo(() => {
        if (!currentFile) return 1;
        return orderedThumbnails.findIndex(t => t.id === currentFile.id) + 1;
    }, [currentFile, orderedThumbnails]);

    // Client comments that belong to an image in this set, with their image
    // position (slot) resolved, ordered image 1..N then oldest version first.
    // Comments on files outside this set (e.g. the video) are left out.
    const clientCommentsWithSlot = useMemo(() => {
        return clientFeedback
            .map(c => ({
                comment: c,
                slotIndex: imageSlots.findIndex(chain => chain.some(f => f.id === c.fileId)),
            }))
            .filter(x => x.slotIndex >= 0)
            .sort((a, b) =>
                a.slotIndex - b.slotIndex ||
                (a.comment.version ?? 1) - (b.comment.version ?? 1) ||
                a.comment.createdAt.getTime() - b.comment.createdAt.getTime(),
            );
    }, [clientFeedback, imageSlots]);

    const slotIndexByCommentId = useMemo(
        () => new Map(clientCommentsWithSlot.map(x => [x.comment.id, x.slotIndex])),
        [clientCommentsWithSlot],
    );

    // Jump to the image + version a client comment was left on.
    const handleJumpToClientComment = (comment: ReviewComment) => {
        const chain = imageSlots.find(c => c.some(f => f.id === comment.fileId));
        const target = chain?.find(f => f.id === comment.fileId);
        if (!target) return;
        setViewMode('single');
        setSidebarTab('comments');
        setViewingVersion(target.version || 1);
        setCurrentFile(target);
    };

    /* ── ← / → arrow keys: previous / next image (single-image view only) ──
       Same effect as clicking the numbered buttons under the image. Doesn't
       wrap around, ignores keys while typing a comment, while the reorder
       dialog is open, and when a modifier key is held. */
    useEffect(() => {
        if (!open || viewMode !== 'single' || showOrderModal || !currentFile || orderedThumbnails.length < 2) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;

            const idx = orderedThumbnails.findIndex(t => t.id === currentFile.id);
            if (idx === -1) return;
            const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
            if (nextIdx < 0 || nextIdx >= orderedThumbnails.length) return;

            e.preventDefault();
            setCurrentFile(orderedThumbnails[nextIdx]);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, viewMode, showOrderModal, currentFile, orderedThumbnails]);

    // Comments are loaded for the whole task and filtered here: only images in
    // this set count, the sidebar shows the image being viewed, and only the
    // images currently on screen (latest of each slot) gate Approve / Send Back.
    const setFileIds = useMemo(() => new Set(imageSlots.flat().map(f => f.id)), [imageSlots]);
    const latestFileIds = useMemo(() => new Set(orderedThumbnails.map(f => f.id)), [orderedThumbnails]);
    const imageComments = useMemo(
        () => comments.filter(c => !c.fileId || setFileIds.has(c.fileId)),
        [comments, setFileIds],
    );
    const fileComments = useMemo(
        () => imageComments.filter(c => !c.fileId || c.fileId === currentFile?.id),
        [imageComments, currentFile?.id],
    );
    const unresolvedCount = imageComments.filter(c => !c.resolved && (!c.fileId || latestFileIds.has(c.fileId))).length;
    const rejectedThumbs = orderedThumbnails
        .map((t, idx) => ({ t, idx, rej: rejections[t.id] }))
        .filter(x => !!x.rej);
    const rejectedCount = rejectedThumbs.length;
    // Everything that blocks Approve and is carried by Send Back.
    const actionCount = unresolvedCount + rejectedCount;
    const currentRejection = currentFile ? rejections[currentFile.id] : undefined;

    // Reset per-task local state when a different task is opened.
    useEffect(() => {
        setCropPatches([]);
        setOrderPatch({});
        setRejections({});
        setActiveMode(null);
        setDrawBaseUrl(null);
        setDrawBox(null);
    }, [taskId]);

    // Leaving the image (or switching view) cancels any draw in progress.
    useEffect(() => {
        setDrawBaseUrl(null);
        setDrawBox(null);
        setActiveMode(null);
    }, [currentFile?.id, viewMode]);

    /* ── Initialise on file change ── */
    useEffect(() => {
        if (file) {
            setCurrentFile(file);
            setComments([]);
            setClientFeedback([]);
            setShowCommentInput(false);
            setImgCrossOriginFailed(false);
            // Snap back to latest whenever a new task/file is opened — only
            // reset here, not on every background refetch, so a reviewer
            // mid-way through browsing history doesn't get yanked forward.
            setViewingVersion(latestVersion);
            fetchFeedback(file.id);
        }
    }, [file]);

    /* ── Lock scroll on html and body ── */
    useEffect(() => {
        if (!open) return;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlScrollbar = document.documentElement.style.scrollbarWidth;

        document.documentElement.classList.add('e8-review-open');
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.scrollbarWidth = 'none';
        document.body.style.overflow = 'hidden';

        return () => {
            document.documentElement.classList.remove('e8-review-open');
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.documentElement.style.scrollbarWidth = prevHtmlScrollbar;
            document.body.style.overflow = prevBodyOverflow;
        };
    }, [open]);

    const REJECT_CATEGORY = 'image_rejected';

    /* ── Data fetching ── */
    // All client-authored comments on this task, mapped for the toolbar
    // dropdown. A client viewer only gets their own, same as the thread below.
    const buildClientFeedback = (feedback: any[]): ReviewComment[] =>
        feedback
            .filter((fb: any) => fb.user?.role === 'client' && fb.fileId)
            .filter((fb: any) => userRole !== 'client' || String(fb.user?.id || 0) === String(user?.id || 0))
            .map((fb: any) => ({
                id: fb.id,
                taskId,
                authorId: String(fb.user?.id || 0),
                authorName: fb.user?.name || 'Client',
                authorRole: 'client',
                content: fb.feedback,
                timestamp: fb.timestamp || '',
                timestampSeconds: 0,
                category: fb.category ? fb.category.split(',') : ['other'],
                createdAt: new Date(fb.createdAt),
                resolved: fb.status === 'resolved',
                version: fb.file?.version || 1,
                fileId: fb.fileId,
            }));

    // Re-reads only the client comment list (used after a new comment is saved).
    const refreshClientFeedback = async () => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.feedback) setClientFeedback(buildClientFeedback(data.feedback));
        } catch (err) {
            console.error('Error fetching client comments:', err);
        }
    };

    const mapFeedbackRow = (fb: any): ReviewComment => ({
        id: fb.id,
        taskId,
        authorId: String(fb.user?.id || 0),
        authorName: fb.user?.name || 'Member',
        authorRole: fb.user?.role || undefined,
        content: fb.feedback,
        timestamp: fb.timestamp || '0:00',
        timestampSeconds: 0,
        isGeneral: fb.timestamp === 'General' || undefined,
        category: fb.category ? fb.category.split(',') : ['other'],
        createdAt: new Date(fb.createdAt),
        resolved: fb.status === 'resolved',
        version: fb.file?.version || 1,
        fileId: fb.fileId || undefined,
        screenshotUrl: fb.screenshotUrl || undefined,
        annotations: fb.annotations || undefined,
        voiceUrl: fb.voiceUrl || undefined,
        voiceDurationSec: fb.voiceDurationSec || undefined,
        attachments: fb.attachments || undefined,
    });

    // Loads the task's feedback once: comments (with their media) plus any
    // "image rejected" rows, which are kept apart from the comment thread.
    const fetchFeedback = async (_fileId?: string) => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.feedback) {
                setClientFeedback(buildClientFeedback(data.feedback));
                const visible = data.feedback
                    .filter((fb: any) => fb.fileId)
                    // QC sees every comment; clients only see comments they authored themselves.
                    .filter((fb: any) => userRole !== 'client' || String(fb.user?.id || 0) === String(user?.id || 0));
                const isRejection = (fb: any) => String(fb.category || '').split(',').includes(REJECT_CATEGORY);
                const rej: Record<string, { id: string; reason: string; content: string }> = {};
                visible
                    .filter((fb: any) => isRejection(fb) && fb.status !== 'resolved')
                    .forEach((fb: any) => {
                        rej[fb.fileId] = {
                            id: fb.id,
                            content: fb.feedback,
                            reason: String(fb.feedback || '').replace(/^Image #\d+ rejected:?\s*/i, ''),
                        };
                    });
                setRejections(rej);
                setComments(visible.filter((fb: any) => !isRejection(fb)).map(mapFeedbackRow));
            }
        } catch (err) {
            console.error('Error fetching feedback:', err);
        }
    };

    /* ── Comment handlers ── */
    const handleCommentSubmit = async (comment: Omit<ReviewComment, 'id' | 'createdAt'>) => {
        const tempId = Date.now().toString();
        const newComment: ReviewComment = {
            ...comment,
            id: tempId,
            createdAt: new Date(),
            version: currentNumber,
            fileId: currentFile?.id,
        };
        // Optimistic UI update
        setComments(prev => [newComment, ...prev]);
        setShowCommentInput(false);

        // Immediate background persistence to database
        if (!taskId || !currentFile) return;
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderType: currentFile.folderType || 'thumbnails',
                    fileId: currentFile.id,
                    feedback: comment.content,
                    timestamp: comment.timestamp || `#${currentNumber}`,
                    category: Array.isArray(comment.category) ? comment.category.join(',') : comment.category,
                    createdBy: user?.id || 0,
                    screenshotUrl: (comment as any).screenshotUrl || null,
                    annotations: (comment as any).annotations || null,
                    voiceUrl: (comment as any).voiceUrl || null,
                    voiceDurationSec: (comment as any).voiceDurationSec || null,
                    attachments: (comment as any).attachments || null,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.feedback?.id) {
                    setComments(prev => prev.map(c => c.id === tempId ? {
                        ...c,
                        id: data.feedback.id,
                        authorId: String(data.feedback.user?.id || data.feedback.createdBy || user?.id || 0),
                        authorName: data.feedback.user?.name || user?.name || 'Member',
                    } : c));
                }
                refreshClientFeedback();
            } else {
                toast.error('Failed to save comment to server');
            }
        } catch (err) {
            console.error('Error saving thumbnail comment:', err);
            toast.error('Failed to save comment to server');
        }
    };

    /* ── Approval / revision handlers ── */
    const submitApproval = (opts?: { sendToClient?: boolean }) => {
        if (!currentFile) return;
        setShowApprovalSuccess(true);
        onApprove(currentFile, opts);
        scheduleCloseAfterSuccess(() => setShowApprovalSuccess(false));
    };

    // Plain approve — no override, so it must NOT take the click event as opts.
    const handleApproveClick = () => submitApproval();
    // QC's two explicit routing buttons.
    const handleSendToClientReviewClick = () => submitApproval({ sendToClient: true });
    const handleBypassClientReviewClick = () => submitApproval({ sendToClient: false });

    const handleRequestRevisionsClick = async (finalRevision = false) => {
        if (!currentFile) return;
        if (actionCount === 0) {
            toast.error('Please add at least one comment or reject an image for revisions');
            return;
        }
        try {
            setSavingFeedback(true);
            const commentItems = imageComments
                .filter(c => !c.resolved && (!c.fileId || latestFileIds.has(c.fileId)))
                .map(c => ({
                    folderType: currentFile.folderType || 'thumbnails',
                    fileId: c.fileId || currentFile.id,
                    feedback: c.content,
                    category: Array.isArray(c.category) ? c.category.join(',') : c.category,
                    timestamp: c.timestamp || '0:00',
                    screenshotUrl: c.screenshotUrl || null,
                    annotations: c.annotations || null,
                    voiceUrl: c.voiceUrl || null,
                    voiceDurationSec: c.voiceDurationSec || null,
                    attachments: c.attachments || null,
                }));
            // Rejected images ride along so the editor sees them in the revision.
            const rejectionItems = rejectedThumbs.map(({ t, idx, rej }) => ({
                folderType: t.folderType || currentFile.folderType || 'thumbnails',
                fileId: t.id,
                feedback: rej!.content,
                category: REJECT_CATEGORY,
                timestamp: `#${idx + 1}`,
            }));
            const feedbackItems = [...commentItems, ...rejectionItems];
            const res = await fetch(`/api/tasks/${taskId}/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackItems, createdBy: user?.id || 0 }),
            });
            if (!res.ok) throw new Error('Failed to save feedback');
            setShowRevisionSuccess(true);
            onRequestRevisions(currentFile, feedbackItems, { finalRevision });
            scheduleCloseAfterSuccess(() => setShowRevisionSuccess(false));
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

    /* ── Titles / descriptions / tags CRUD ── */
    const getList = (type: PostingType) =>
        type === 'titles' ? postingTitles : type === 'descriptions' ? postingDescriptions : postingTags;
    const getSetter = (type: PostingType) =>
        type === 'titles' ? onPostingTitlesChange : type === 'descriptions' ? onPostingDescriptionsChange : onPostingTagsChange;

    const addItem = (type: PostingType) => {
        const text = newTexts[type].trim();
        if (!text) return;
        const currentList = getList(type);
        const setCurrentList = getSetter(type);
        if (!setCurrentList || currentList.length >= CAPS[type]) return;
        setCurrentList([...currentList, { id: `${Date.now()}-${Math.random()}`, text }]);
        setNewTexts(prev => ({ ...prev, [type]: '' }));
    };

    const deleteItem = (type: PostingType, id: string) => {
        const currentList = getList(type);
        const setCurrentList = getSetter(type);
        if (!setCurrentList) return;
        if (type === 'titles' && userRole === 'client' && currentList.length <= 1) return;
        setCurrentList(currentList.filter(i => i.id !== id));
    };

    const startEdit = (id: string, text: string) => { setEditingId(id); setEditingText(text); };

    const commitEdit = (type: PostingType) => {
        if (!editingId) return;
        const currentList = getList(type);
        const setCurrentList = getSetter(type);
        if (!setCurrentList) return;
        const text = editingText.trim();
        if (text) setCurrentList(currentList.map(i => i.id === editingId ? { ...i, text } : i));
        setEditingId(null);
        setEditingText('');
    };

    const toggleTemplateHashtag = (tag: string) => {
        if (!onPostingTagsChange) return;
        if (postingTags.some(t => t.text === tag)) {
            onPostingTagsChange(postingTags.filter(t => t.text !== tag));
        } else if (postingTags.length < CAPS.tags) {
            onPostingTagsChange([...postingTags, { id: `${Date.now()}-${Math.random()}`, text: tag }]);
        }
    };

    // Start the tag list from the client's template hashtags when it's empty.
    const hasSeededTags = useRef(false);
    useEffect(() => {
        if (hasSeededTags.current || !onPostingTagsChange) return;
        if (!templateHashtags || templateHashtags.length === 0) return;
        if (postingTags.length > 0) { hasSeededTags.current = true; return; }
        onPostingTagsChange(templateHashtags.slice(0, CAPS.tags).map(tag => ({ id: `${Date.now()}-${Math.random()}`, text: tag })));
        hasSeededTags.current = true;
    }, [templateHashtags, postingTags, onPostingTagsChange]);

    const handleTabChange = (tab: SidebarTab) => {
        setSidebarTab(tab);
        setNewTexts({ titles: '', descriptions: '', tags: '' });
        setEditingId(null);
        setEditingText('');
    };

    /* ── Reject whole image ── */
    const handleRejectImage = async () => {
        if (!currentFile) return;
        const reason = rejectReason.trim();
        if (!reason) {
            toast.error('Please say why this image is rejected');
            return;
        }
        const n = Math.max(1, currentNumber);
        const content = `Image #${n} rejected: ${reason}`;
        setRejecting(true);
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderType: currentFile.folderType || 'thumbnails',
                    fileId: currentFile.id,
                    feedback: content,
                    timestamp: `#${n}`,
                    category: REJECT_CATEGORY,
                    createdBy: user?.id || 0,
                }),
            });
            if (!res.ok) throw new Error('Failed to save rejection');
            const data = await res.json();
            setRejections(prev => ({ ...prev, [currentFile.id]: { id: data.feedback?.id || String(Date.now()), reason, content } }));
            setShowRejectDialog(false);
            setRejectReason('');
            toast.success(`Image #${n} rejected`);
        } catch (err) {
            console.error('Error rejecting image:', err);
            toast.error('Failed to reject image');
        } finally {
            setRejecting(false);
        }
    };

    const handleUndoReject = async (fileId: string) => {
        const rej = rejections[fileId];
        if (!rej) return;
        setRejections(prev => { const next = { ...prev }; delete next[fileId]; return next; });
        try {
            const res = await fetch(`/api/tasks/${taskId}/feedback?feedbackId=${rej.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('delete failed');
        } catch (err) {
            console.error('Error undoing rejection:', err);
            setRejections(prev => ({ ...prev, [fileId]: rej }));
            toast.error('Failed to undo rejection');
        }
    };

    /* ── Crop / aspect ratio ── */
    const handleCropSave = async (blob: Blob) => {
        if (!currentFile) return;
        setCropSaving(true);
        try {
            const oldId = currentFile.id;
            const fd = new FormData();
            fd.append('file', blob, currentFile.name);
            const res = await fetch(`/api/tasks/${taskId}/files/${oldId}/crop`, { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.file) throw new Error(data.error || data.message || 'Failed to save crop');
            const newFile = data.file as TaskFile;
            setCropPatches(prev => [...prev, { oldId, file: newFile }]);
            setOrderPatch(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(k => { if (next[k] === oldId) next[k] = newFile.id; });
                next[oldId] = newFile.id;
                return next;
            });
            // A rejection belongs to the old picture, not the corrected one.
            setViewingVersion(newFile.version || 1);
            setCurrentFile(newFile);
            setImgCrossOriginFailed(false);
            onImageReplaced?.(oldId, newFile);
            setShowCrop(false);
            toast.success('Crop saved as a new version — the original is kept in version history');
        } catch (err: any) {
            console.error('Error saving crop:', err);
            toast.error(err?.message || 'Failed to save crop');
        } finally {
            setCropSaving(false);
        }
    };

    /* ── Review tools: Draw / Voice / Attach ── */
    const exitDrawMode = () => {
        setDrawBaseUrl(null);
        setDrawBox(null);
        setActiveMode(null);
    };

    const handleModeSelect = (mode: ReviewMode) => {
        setSidebarTab('comments');
        setShowCommentInput(true);

        if (mode === 'draw') {
            if (drawBaseUrl) { exitDrawMode(); return; }
            const img = imageRef.current;
            const stage = imageStageRef.current;
            if (!img || !stage) return;
            const dataUrl = captureFullFrameFromSource(img);
            if (!dataUrl) {
                toast.error("Can't draw on this image right now — it couldn't be read. Try reloading it.");
                return;
            }
            const ir = img.getBoundingClientRect();
            const sr = stage.getBoundingClientRect();
            setDrawBox({ left: ir.left - sr.left, top: ir.top - sr.top, width: ir.width, height: ir.height });
            setDrawBaseUrl(dataUrl);
            setActiveMode('draw');
            return;
        }

        if (drawBaseUrl) exitDrawMode();
        setActiveMode(mode);
        window.requestAnimationFrame(() => {
            const api = commentInputRef.current;
            if (!api) return;
            if (mode === 'voice') api.startVoice();
            else if (mode === 'attach') api.openAttach();
            else api.openComment();
        });
    };

    const handleDrawComplete = (composedDataUrl: string) => {
        setDrawBaseUrl(null);
        setDrawBox(null);
        setActiveMode('comment');
        setShowCommentInput(true);
        window.requestAnimationFrame(() => {
            commentInputRef.current?.setScreenshot(composedDataUrl);
        });
    };

    /* ── Guard ── */
    if (!currentFile) return null;

    // Back / Esc step back one level: single-image view → gallery, and only
    // from the gallery do they close the whole review. The X button still
    // closes the modal from either view.
    const handleBack = () => {
        if (viewMode === 'single') setViewMode('gallery');
        else onOpenChange(false);
    };

    const handleEscapeKeyDown = (e: KeyboardEvent) => {
        if (viewMode !== 'single') return; // gallery: default Esc closes the modal
        e.preventDefault(); // never close the whole modal from the single view
        // Esc while typing a comment is for the input, not for navigation.
        const el = e.target as HTMLElement | null;
        const isTyping = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!isTyping) setViewMode('gallery');
    };

    /* ─────────────────────────────────────────────────────────── */
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onEscapeKeyDown={handleEscapeKeyDown} className="!fixed !inset-0 !z-50 !w-full !h-full !max-w-none !max-h-none !m-0 !p-0 !overflow-hidden !transform-none !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !rounded-none !border-none !shadow-none !flex !flex-col !gap-0 fullscreen-dialog review-modal">
                <TooltipProvider delayDuration={300}>
                    <div className="sr-only">
                        <DialogTitle>Review {currentFile.name}</DialogTitle>
                        <DialogDescription>Review and provide feedback on this image.</DialogDescription>
                    </div>

                    <div className="relative w-full h-full flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--review-bg-primary)' }}>

                        {/* ── Reject image dialog ── */}
                        {showRejectDialog && (
                            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={() => !rejecting && setShowRejectDialog(false)}>
                                <div
                                    className="w-[440px] max-w-[92vw] rounded-xl border border-[var(--review-border)] p-5 space-y-3"
                                    style={{ background: 'var(--review-bg-secondary)' }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-2 text-white">
                                        <Ban className="h-5 w-5 text-red-400" />
                                        <h3 className="text-base font-semibold">Reject image #{currentNumber}</h3>
                                    </div>
                                    <p className="text-xs text-[var(--review-text-muted)] leading-relaxed">
                                        This image is not usable for the set. The set can't be approved while it is rejected, and it is sent back to the editor with your reason.
                                    </p>
                                    <textarea
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="Why is this image rejected?"
                                        rows={3}
                                        autoFocus
                                        className="w-full text-sm rounded-lg bg-[var(--review-bg-tertiary)] border border-[var(--review-border)] text-white placeholder:text-[var(--review-text-muted)] p-2.5 resize-none outline-none focus:border-white/40"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setShowRejectDialog(false)}
                                            disabled={rejecting}
                                            className="px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/10 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleRejectImage}
                                            disabled={rejecting || !rejectReason.trim()}
                                            className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            {rejecting ? 'Rejecting…' : 'Reject image'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                        <p className="text-orange-300/80">{actionCount} item{actionCount !== 1 ? "s" : ""} saved to task.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* ── HEADER ── */}
                        <div
                            className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--review-border)] min-w-0"
                            style={{ background: 'var(--review-bg-secondary)', height: 57 }}
                        >
                            {/* Left: back + title */}
                            <div className="flex items-center gap-4 min-w-0">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleBack}
                                            title="Go back"
                                            className="h-[38px] px-3 flex items-center justify-center gap-1.5 bg-transparent rounded-md cursor-pointer transition-colors text-sm font-medium text-white hover:bg-white/10"
                                            style={{ border: '1px solid var(--review-border-hover)' }}
                                        >
                                            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.5} /> Back
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Go back</TooltipContent>
                                </Tooltip>

                                <div style={{ width: 1, height: 32, background: 'var(--review-border)' }} className="shrink-0" />

                                <E8Logo height={28} className="shrink-0" />

                                <div style={{ width: 1, height: 32, background: 'var(--review-border)' }} className="shrink-0" />

                                <div className="flex items-baseline gap-3 min-w-0">
                                    <h1 className="text-base font-semibold text-white truncate max-w-md" style={{ letterSpacing: '-0.01em' }}>{taskTitle}</h1>
                                    {latestVersion > 1 && (
                                        <div className="flex items-center gap-0.5 bg-white/15 rounded-full pl-1 pr-2 py-0.5 shrink-0">
                                            <button
                                                onClick={() => setViewingVersion(v => Math.max(1, v - 1))}
                                                disabled={viewingVersion <= 1}
                                                className="disabled:opacity-30 disabled:cursor-not-allowed text-white hover:bg-white/15 rounded-full p-0.5 transition-colors"
                                                title="Previous version"
                                            >
                                                <ChevronLeft className="h-3 w-3" />
                                            </button>
                                            <span className="text-[11px] font-semibold text-white px-0.5">
                                                Version {viewingVersion}{viewingVersion === latestVersion ? ' (Latest)' : ''}
                                            </span>
                                            <button
                                                onClick={() => setViewingVersion(v => Math.min(latestVersion, v + 1))}
                                                disabled={viewingVersion >= latestVersion}
                                                className="disabled:opacity-30 disabled:cursor-not-allowed text-white hover:bg-white/15 rounded-full p-0.5 transition-colors"
                                                title="Next version"
                                            >
                                                <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    <span style={{ width: 1, height: 14, background: 'var(--review-border)', flex: 'none', alignSelf: 'center' }} />
                                    <span className="text-xs text-[var(--review-text-muted)] font-medium">
                                        {imageLabel} &bull; {orderedThumbnails.length} image{orderedThumbnails.length !== 1 ? 's' : ''}
                                    </span>
                                    {userRole === 'qc' && editorName && (
                                        <>
                                            <span style={{ width: 1, height: 14, background: 'var(--review-border)', flex: 'none', alignSelf: 'center' }} />
                                            <span className="text-xs text-[var(--review-text-muted)] font-medium truncate max-w-[220px]" title={`Editor: ${editorName}`}>
                                                Editor: <span className="text-white font-semibold">{editorName}</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right: icon-only actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {onSwitchToVideo && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="sm"
                                                onClick={onSwitchToVideo}
                                                className="bg-white hover:bg-white text-black hover:text-black h-[38px] px-3 gap-1.5 rounded-md font-semibold text-xs"
                                            >
                                                <Film className="h-4 w-4" />
                                                <span>Video</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Switch to Video Review</TooltipContent>
                                    </Tooltip>
                                )}

                                <ClientCommentsDropdown
                                    comments={clientCommentsWithSlot.map(x => x.comment)}
                                    onJump={handleJumpToClientComment}
                                    getLocationLabel={c => {
                                        const idx = slotIndexByCommentId.get(c.id);
                                        return idx === undefined ? null : `#${idx + 1}`;
                                    }}
                                />

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setViewMode(v => v === 'gallery' ? 'single' : 'gallery')}
                                            title={viewMode === 'gallery' ? 'Single view' : 'Gallery view'}
                                            className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                            style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                        >
                                            <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">{viewMode === 'gallery' ? 'Single view' : 'Gallery view'}</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleDownload}
                                            title="Download"
                                            className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                            style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-hover-download)'; e.currentTarget.style.borderColor = 'var(--review-v2-hover-download)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                        >
                                            <Download className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Download</TooltipContent>
                                </Tooltip>

                                <button
                                    onClick={() => onOpenChange(false)}
                                    title="Close"
                                    className="w-[38px] h-[38px] flex items-center justify-center bg-transparent rounded-md cursor-pointer transition-colors"
                                    style={{ border: `1px solid var(--review-border-hover)`, color: 'var(--review-v2-gray-100)' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--review-v2-send-back)'; e.currentTarget.style.borderColor = 'var(--review-v2-send-back)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--review-border-hover)'; }}
                                >
                                    <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                                </button>
                            </div>
                        </div>

                        {/* ── BODY ── */}
                        <div className="flex-1 flex overflow-hidden min-h-0" style={{ background: 'var(--review-bg-primary)' }}>

                            {/* ── IMAGE AREA ── */}
                            <div
                                className="flex-1 relative flex flex-col overflow-hidden m-4 mr-2"
                                style={{ background: 'var(--review-bg-tertiary)', border: '1px solid var(--review-v2-gray-800)', borderRadius: 16 }}
                            >
                                {viewMode === 'gallery' ? (
                                    /* Gallery grid */
                                    <div className="flex-1 overflow-auto p-6 pb-24">
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
                                                    {/* Show the full image at its natural ratio (no 16:9 crop). Very tall
                                                        images are capped to the viewport height and letterboxed. */}
                                                    <div className="relative bg-black flex items-center justify-center min-h-[160px]">
                                                        <img src={t.url} alt={t.name} className={`w-full h-auto max-h-[75vh] object-contain ${rejections[t.id] ? 'opacity-40' : ''}`} />
                                                        {rejections[t.id] && (
                                                            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1 shadow">
                                                                <Ban className="h-3 w-3" /> Rejected
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Button variant="secondary" size="sm" className="bg-white text-black hover:bg-zinc-200">
                                                                Review Details
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-[var(--review-bg-secondary)] border-t border-[var(--review-border)] flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--review-text-muted)] font-medium truncate max-w-[160px]">{t.name}</span>
                                                        {imageComments.some(c => c.fileId === t.id) && (
                                                            <Badge className="bg-orange-500/20 text-orange-500 text-[9px] border-none flex items-center gap-1">
                                                                <MessageSquare className="h-2.5 w-2.5" />
                                                                {imageComments.filter(c => c.fileId === t.id).length}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Single image view */
                                    <div className="flex-1 relative bg-black flex flex-col items-center justify-between overflow-hidden p-4 sm:p-6 gap-3">
                                        <div ref={imageStageRef} className="flex-1 w-full min-h-0 relative group flex items-center justify-center">
                                            <img
                                                key={currentFile.id + (imgCrossOriginFailed ? '-nocors' : '')}
                                                ref={imageRef}
                                                crossOrigin={imgCrossOriginFailed ? undefined : "anonymous"}
                                                src={currentFile.url}
                                                alt={currentFile.name}
                                                className={`max-w-full max-h-full object-contain shadow-2xl rounded-sm ${currentRejection ? 'opacity-50 ring-2 ring-red-500' : ''}`}
                                                onError={() => {
                                                    if (!imgCrossOriginFailed) {
                                                        console.warn(`[ThumbnailReviewModal] "${currentFile.name}" failed to load with crossOrigin="anonymous" — retrying without it. Screenshot/draw capture will be unavailable for this image until it reloads cleanly.`);
                                                        setImgCrossOriginFailed(true);
                                                    }
                                                }}
                                            />
                                            {drawBaseUrl && drawBox && (
                                                <div
                                                    ref={setDrawBoxEl}
                                                    className="absolute"
                                                    style={{ left: drawBox.left, top: drawBox.top, width: drawBox.width, height: drawBox.height }}
                                                >
                                                    {drawBoxEl && (
                                                        <ReviewDrawOverlay
                                                            baseImageUrl={drawBaseUrl}
                                                            container={drawBoxEl}
                                                            onComplete={handleDrawComplete}
                                                            onCancel={exitDrawMode}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            {currentRejection && (
                                                <div className="absolute top-4 left-4 z-20 max-w-[70%] flex items-center gap-2 rounded-lg bg-red-600/95 text-white px-3 py-2 shadow-lg">
                                                    <Ban className="h-4 w-4 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold uppercase tracking-wide">Image #{currentNumber} rejected</p>
                                                        <p className="text-xs truncate" title={currentRejection.reason}>{currentRejection.reason}</p>
                                                    </div>
                                                    {!readOnly && viewingVersion === latestVersion && (
                                                        <button
                                                            onClick={() => handleUndoReject(currentFile.id)}
                                                            className="ml-1 shrink-0 flex items-center gap-1 rounded-md bg-white/20 hover:bg-white/30 px-2 py-1 text-[11px] font-semibold"
                                                        >
                                                            <Undo2 className="h-3 w-3" /> Undo
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button
                                                    size="icon" variant="secondary"
                                                    className="bg-black/50 hover:bg-black/80 text-white border-none"
                                                    onClick={() => window.open(currentFile.url, '_blank')}
                                                >
                                                    <Maximize className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {!readOnly && viewingVersion === latestVersion && (
                                            <div className="shrink-0 z-20 flex justify-center">
                                                <ReviewModePills
                                                    activeMode={activeMode}
                                                    onSelect={handleModeSelect}
                                                    hiddenModes={['range']}
                                                    disabled={cropSaving}
                                                />
                                            </div>
                                        )}

                                        {/* Bottom thumbnail picker — matches ReviewModePills' segmented-pill styling */}
                                        <div
                                            className="shrink-0 z-20 rounded-md px-4 py-2 flex items-center gap-2"
                                            style={{
                                                background: 'var(--review-v2-gray-950)',
                                                border: '1px solid var(--review-v2-gray-600)',
                                            }}
                                        >
                                            <span className="text-[10px] font-bold text-[var(--review-text-muted)] uppercase tracking-widest mr-2">
                                                {imageLabel}
                                            </span>
                                            {orderedThumbnails.map((t, idx) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setCurrentFile(t)}
                                                    className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                                                    style={currentFile.id === t.id
                                                        ? { background: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }
                                                        : { background: 'transparent', color: 'var(--review-v2-gray-100)' }}
                                                >
                                                    {idx + 1}
                                                </button>
                                            ))}
                                            <div className="h-4 w-px mx-1" style={{ background: 'var(--review-v2-gray-600)' }} />
                                            <button
                                                onClick={() => setViewMode('gallery')}
                                                className="p-1.5 rounded-md text-[var(--review-text-muted)] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                                title="Gallery view"
                                            >
                                                <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                            {!readOnly && viewingVersion === latestVersion && (
                                                <>
                                                    <div className="h-4 w-px mx-1" style={{ background: 'var(--review-v2-gray-600)' }} />
                                                    <button
                                                        onClick={() => { exitDrawMode(); setShowCrop(true); }}
                                                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold text-[var(--review-v2-gray-100)] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                                        title="Crop or change aspect ratio — saves as a new version of this image"
                                                    >
                                                        <Crop className="h-4 w-4" strokeWidth={1.5} /> Crop
                                                    </button>
                                                    {currentRejection ? (
                                                        <button
                                                            onClick={() => handleUndoReject(currentFile.id)}
                                                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-all cursor-pointer"
                                                            title="Remove the rejection from this image"
                                                        >
                                                            <Undo2 className="h-4 w-4" strokeWidth={1.5} /> Undo reject
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setRejectReason(''); setShowRejectDialog(true); }}
                                                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-all cursor-pointer"
                                                            title="Reject this image for the set"
                                                        >
                                                            <Ban className="h-4 w-4" strokeWidth={1.5} /> Reject
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {orderedThumbnails.length > 1 && viewingVersion === latestVersion && (
                                                <>
                                                    <div className="h-4 w-px mx-1" style={{ background: 'var(--review-v2-gray-600)' }} />
                                                    <ImageOrderPopover
                                                        files={orderedThumbnails}
                                                        currentFileId={currentFile?.id}
                                                        onSelectFile={(f) => {
                                                            setCurrentFile(f);
                                                            setViewMode('single');
                                                        }}
                                                        onReorder={handleReorderImages}
                                                        isSaving={isSavingOrder}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Floating Order button in gallery view — matches ReviewModePills' segmented-pill styling */}
                                {viewMode === 'gallery' && orderedThumbnails.length > 1 && viewingVersion === latestVersion && (
                                    <div
                                        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md px-4 py-2 flex items-center gap-2 z-20"
                                        style={{
                                            background: 'var(--review-v2-gray-950)',
                                            border: '1px solid var(--review-v2-gray-600)',
                                        }}
                                    >
                                        <span className="text-[10px] font-bold text-[var(--review-text-muted)] uppercase tracking-widest mr-1">
                                            {imageLabel} ({orderedThumbnails.length})
                                        </span>
                                        <div className="h-4 w-px mx-1" style={{ background: 'var(--review-v2-gray-600)' }} />
                                        <ImageOrderPopover
                                            files={orderedThumbnails}
                                            currentFileId={currentFile?.id}
                                            onSelectFile={(f) => {
                                                setCurrentFile(f);
                                                setViewMode('single');
                                            }}
                                            onReorder={handleReorderImages}
                                            isSaving={isSavingOrder}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* ── SIDEBAR — hidden entirely in read-only playback mode ── */}
                            {!readOnly && (
                            <div
                                className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden m-4 ml-2"
                                style={{ background: 'var(--review-bg-secondary)', border: '1px solid var(--review-border)', borderRadius: 16 }}
                            >
                                {/* Tab switcher matching Screenshot 2 */}
                                <div className={`grid ${is3Step ? 'grid-cols-3' : 'grid-cols-2'} border-b border-[var(--review-border)]`} style={{ background: 'var(--review-bg-secondary)' }}>
                                    <button
                                        onClick={() => setSidebarTab('comments')}
                                        className="text-sm flex items-center justify-center gap-1.5 py-3.5 px-1 -mb-px cursor-pointer transition-colors"
                                        style={sidebarTab === 'comments'
                                            ? { background: 'transparent', color: '#fff', fontWeight: 600, border: 'none', borderBottom: '2px solid #fff' }
                                            : { background: 'transparent', color: 'var(--review-v2-gray-400)', fontWeight: 400, border: 'none', borderBottom: '2px solid transparent' }}
                                    >
                                        Comments
                                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                                    </button>
                                    <button
                                        onClick={() => setSidebarTab('titles')}
                                        className="text-sm py-3.5 px-1 -mb-px cursor-pointer transition-colors"
                                        style={sidebarTab === 'titles'
                                            ? { background: 'transparent', color: '#fff', fontWeight: 600, border: 'none', borderBottom: '2px solid #fff' }
                                            : { background: 'transparent', color: 'var(--review-v2-gray-400)', fontWeight: 400, border: 'none', borderBottom: '2px solid transparent' }}
                                    >
                                        Titles
                                    </button>
                                    {is3Step && (
                                        <button
                                            onClick={() => setSidebarTab('thumbnails')}
                                            className="text-sm py-3.5 px-1 -mb-px cursor-pointer transition-colors"
                                            style={sidebarTab === 'thumbnails'
                                                ? { background: 'transparent', color: '#fff', fontWeight: 600, border: 'none', borderBottom: '2px solid #fff' }
                                                : { background: 'transparent', color: 'var(--review-v2-gray-400)', fontWeight: 400, border: 'none', borderBottom: '2px solid transparent' }}
                                        >
                                            {imageLabel}
                                        </button>
                                    )}
                                </div>

                                {/* ── COMMENTS TAB ── */}
                                {sidebarTab === 'comments' && (<>
                                    {viewingVersion === latestVersion ? (
                                        <div className="p-3 border-b border-[var(--review-border)] flex-shrink-0">
                                            <CommentInput
                                                ref={commentInputRef}
                                                taskId={taskId}
                                                currentTime={0}
                                                currentTimestamp={`#${currentNumber}`}
                                                authorId={user?.id ? String(user.id) : 'guest'}
                                                authorName={user?.name || 'Client'}
                                                imageRef={imageRef}
                                                mode="thumbnail"
                                                thumbnailIndex={currentNumber}
                                                onSubmit={handleCommentSubmit}
                                                onCancel={() => setShowCommentInput(false)}
                                                isExpanded={showCommentInput}
                                                onToggleExpand={() => setShowCommentInput(true)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="px-3 py-2 border-b border-[var(--review-border)] flex-shrink-0 text-xs text-zinc-500">
                                            Viewing a past version — comments shown are from that version.
                                        </div>
                                    )}
                                    <div className="flex-1 overflow-y-auto p-3 review-scrollbar min-h-0">
                                        {fileComments.length === 0 ? (
                                            <div className="text-center py-12 text-[var(--review-text-muted)]">
                                                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                                <p className="text-sm">No comments yet</p>
                                                <p className="text-xs mt-1 opacity-70">Add a comment to leave feedback</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {fileComments.map(comment => (
                                                    <div key={comment.id}>
                                                        <ReviewCommentCard
                                                            comment={comment}
                                                            onResolve={(id, resolved) => {
                                                                setComments(prev => prev.map(c => c.id === id ? { ...c, resolved } : c));
                                                                if (taskId && !/^\d{13}$/.test(id)) {
                                                                    fetch(`/api/tasks/${taskId}/feedback?feedbackId=${id}&action=${resolved ? 'resolve' : 'delete'}`, { method: 'DELETE' }).catch(console.error);
                                                                }
                                                            }}
                                                            onDelete={(id) => {
                                                                setComments(prev => prev.filter(c => c.id !== id));
                                                                if (taskId && !/^\d{13}$/.test(id)) {
                                                                    fetch(`/api/tasks/${taskId}/feedback?feedbackId=${id}`, { method: 'DELETE' }).catch(console.error);
                                                                }
                                                            }}
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
                                        {(['titles', 'descriptions', 'tags'] as const).map(type => {
                                            const currentList = getList(type);
                                            const cap = CAPS[type];
                                            const atCap = currentList.length >= cap;
                                            const labels = {
                                                titles:       { singular: 'title',       placeholder: 'Add a title…'       },
                                                descriptions: { singular: 'description', placeholder: 'Add a description…' },
                                                tags:         { singular: 'tag',         placeholder: 'Add a tag…'         },
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

                                                    {type === 'tags' && (templateHashtags?.length ?? 0) > 0 && (
                                                        <div className="px-3 mt-2">
                                                            <span className="text-[10px] font-medium text-[var(--review-text-muted)] uppercase tracking-wide">Client tags</span>
                                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                {templateHashtags!.map(tag => {
                                                                    const selected = postingTags.some(t => t.text === tag);
                                                                    return (
                                                                        <button
                                                                            key={tag}
                                                                            type="button"
                                                                            onClick={() => toggleTemplateHashtag(tag)}
                                                                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer"
                                                                            style={selected
                                                                                ? { background: 'var(--review-v2-gray-50)', borderColor: 'var(--review-v2-gray-50)', color: 'var(--review-v2-gray-950)' }
                                                                                : { background: 'transparent', borderColor: 'var(--review-border)', color: 'var(--review-text-muted)' }}
                                                                        >
                                                                            {tag}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* List items */}
                                                    <div className="px-3 space-y-2 mt-2">
                                                        {currentList.length === 0 ? (
                                                            <div className="text-center py-4 text-[var(--review-text-muted)]">
                                                                <p className="text-xs opacity-70">No {singular}s yet</p>
                                                            </div>
                                                        ) : currentList.map(item => (
                                                            <div key={item.id} className={`group rounded-lg border p-2.5 ${editingId !== item.id ? 'bg-[var(--review-v2-gray-50)] border-transparent' : 'border-[var(--review-border)] bg-[var(--review-bg-tertiary)]'}`}>
                                                                {editingId === item.id ? (
                                                                    <div className="space-y-1.5">
                                                                        <Input
                                                                            value={editingText}
                                                                            onChange={e => setEditingText(e.target.value)}
                                                                            className="text-xs h-8 bg-[var(--review-bg-secondary)] border-[var(--review-border)] text-white selection:bg-[#8b5cf6] selection:text-white"
                                                                            autoFocus
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter') commitEdit(type);
                                                                                if (e.key === 'Escape') { setEditingId(null); setEditingText(''); }
                                                                            }}
                                                                        />
                                                                        <div className="flex gap-1">
                                                                            <Button size="sm" onClick={() => commitEdit(type)} className="h-6 px-2 text-[10px] bg-white text-black hover:bg-gray-200">Save</Button>
                                                                            <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingText(''); }} className="h-6 px-2 text-[10px] text-[var(--review-text-muted)]">Cancel</Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-start gap-2">
                                                                        <p className="flex-1 text-xs text-black leading-relaxed break-words min-w-0">{item.text}</p>
                                                                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                onClick={() => startEdit(item.id, item.text)}
                                                                                className="p-1 rounded transition-colors hover:bg-black/10 text-black/50 hover:text-black"
                                                                                title={`Edit ${singular}`}
                                                                            >
                                                                                <PenLine className="h-3 w-3" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => deleteItem(type, item.id)}
                                                                                disabled={type === 'titles' && userRole === 'client' && currentList.length <= 1}
                                                                                className="p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-500/15 text-black/50 hover:text-red-600"
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

                                {/* ── THUMBNAILS TAB ── */}
                                {sidebarTab === 'thumbnails' && (
                                    <div className="flex-1 overflow-y-auto review-scrollbar min-h-0 p-4 space-y-4">
                                        <div className="rounded-xl border border-[var(--review-border)] p-4 bg-[var(--review-bg-tertiary)]">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold uppercase tracking-wide text-white">Candidate {imageLabel}</span>
                                                <span className="text-xs font-medium text-[var(--review-text-muted)]">{orderedThumbnails.length} variants</span>
                                            </div>
                                            <div className="space-y-2">
                                                {orderedThumbnails.map((t, idx) => (
                                                    <div
                                                        key={t.id}
                                                        onClick={() => setCurrentFile(t)}
                                                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                                                            currentFile.id === t.id
                                                                ? 'border-white bg-white/10'
                                                                : 'border-[var(--review-border)] hover:border-white/20'
                                                        }`}
                                                    >
                                                        <div className="w-16 aspect-video rounded overflow-hidden bg-black shrink-0 relative">
                                                            <img src={t.url} alt={t.name} className="w-full h-full object-cover" />
                                                            <span className="absolute top-0.5 left-1 text-[10px] font-bold text-white bg-black/60 px-1 rounded">#{idx + 1}</span>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-medium text-white truncate">{t.name}</p>
                                                            <p className="text-[10px] text-[var(--review-text-muted)]">Option #{idx + 1}</p>
                                                        </div>
                                                        {rejections[t.id] && (
                                                            <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">Rejected</span>
                                                        )}
                                                        {currentFile.id === t.id && (
                                                            <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-full font-bold">Selected</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── ACTION FOOTER MATCHING SCREENSHOT 2 ── */}
                                <div
                                    className="p-4 border-t border-[var(--review-border)] flex flex-col gap-2 flex-shrink-0 bg-[var(--review-bg-secondary)]"
                                >
                                    <div className="flex items-center justify-between gap-2 pb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                            {stepLabel}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setSidebarTab('comments')}
                                                title="Comments"
                                                className={`cursor-pointer p-0 transition-all border-0 ${
                                                    sidebarTab === 'comments'
                                                        ? 'w-6 h-1.5 bg-white rounded-full'
                                                        : (okComments ? 'w-4 h-1.5 bg-zinc-400 rounded-full' : 'w-4 h-1.5 bg-zinc-700 rounded-full')
                                                }`}
                                            />
                                            <button
                                                onClick={() => setSidebarTab('titles')}
                                                title="Titles"
                                                className={`cursor-pointer p-0 transition-all border-0 ${
                                                    sidebarTab === 'titles'
                                                        ? 'w-6 h-1.5 bg-white rounded-full'
                                                        : (okTitles ? 'w-4 h-1.5 bg-zinc-400 rounded-full' : 'w-4 h-1.5 bg-zinc-700 rounded-full')
                                                }`}
                                            />
                                            {is3Step && (
                                                <button
                                                    onClick={() => setSidebarTab('thumbnails')}
                                                    title={imageLabel}
                                                    className={`cursor-pointer p-0 transition-all border-0 ${
                                                        sidebarTab === 'thumbnails'
                                                            ? 'w-6 h-1.5 bg-white rounded-full'
                                                            : (okThumbnails ? 'w-4 h-1.5 bg-zinc-400 rounded-full' : 'w-4 h-1.5 bg-zinc-700 rounded-full')
                                                    }`}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {viewingVersion !== latestVersion ? (
                                        <div className="flex flex-col items-center gap-2 text-center py-2">
                                            <span className="text-xs text-zinc-400">
                                                Viewing Version {viewingVersion} — a past snapshot of this set.
                                            </span>
                                            <button
                                                onClick={() => setViewingVersion(latestVersion)}
                                                className="text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors"
                                            >
                                                Back to Latest (Version {latestVersion}) to take action
                                            </button>
                                        </div>
                                    ) : userRole === 'qc' ? (
                                        <div className="flex flex-col gap-2">
                                            {/* Row 1: Approve & Send Back (Side by Side) */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={handleStepApprove}
                                                    disabled={savingFeedback || unresolvedCount > 0 || rejectedCount > 0}
                                                    title={rejectedCount > 0 ? 'Resolve or undo the rejected image(s) first' : undefined}
                                                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-3 rounded-lg cursor-pointer transition-all bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-sm border border-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                                                    {approveLabel}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        if (actionCount === 0) {
                                                            toast.error('Please add a comment or reject an image before sending back');
                                                            return;
                                                        }
                                                        handleRequestRevisionsClick(false);
                                                    }}
                                                    disabled={savingFeedback}
                                                    className={`w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-3 rounded-lg cursor-pointer transition-all border disabled:cursor-not-allowed hover:bg-[#dc2626] hover:border-[#dc2626] hover:text-white ${
                                                        actionCount > 0
                                                            ? 'bg-[#a6303a] border-[#a6303a] text-white'
                                                            : 'bg-[#18181b] border-[#38383d] text-zinc-300'
                                                    }`}
                                                >
                                                    {savingFeedback ? (
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                    ) : (
                                                        <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
                                                    )}
                                                    Send Back ({actionCount})
                                                </button>
                                            </div>

                                            {finalRevisionLocked && (
                                                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300 leading-relaxed">
                                                    <span className="font-semibold">Client's final revision.</span>{' '}
                                                    This task can't be sent back to the client. Approving it sends it straight to the scheduler.
                                                </div>
                                            )}
                                            {/* Row 2: Send to Client Review & Bypass Client Review */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={handleSendToClientReviewClick}
                                                    disabled={savingFeedback || unresolvedCount > 0 || rejectedCount > 0 || finalRevisionLocked}
                                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-2 rounded-lg cursor-pointer transition-all bg-white/5 hover:bg-[#2563eb] hover:border-[#3b82f6] hover:text-white text-white border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title={finalRevisionLocked ? "Blocked: the client chose Final Revision on this task, so it goes straight to the scheduler" : "Send directly to client review"}
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                    <span className="truncate">Send to Client Review</span>
                                                </button>

                                                <button
                                                    onClick={handleBypassClientReviewClick}
                                                    disabled={savingFeedback || unresolvedCount > 0 || rejectedCount > 0}
                                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-2 rounded-lg cursor-pointer transition-all bg-white/5 hover:bg-[#eab308] hover:border-[#facc15] hover:text-black text-white border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title="Bypass client review and finalize delivery"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    <span className="truncate">Bypass Client Review</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleStepApprove}
                                                disabled={savingFeedback || unresolvedCount > 0 || rejectedCount > 0}
                                                title={rejectedCount > 0 ? 'Resolve or undo the rejected image(s) first' : undefined}
                                                className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-lg cursor-pointer transition-all bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-sm border border-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                                                {approveLabel}
                                            </button>

                                            <div className="flex items-stretch gap-2">
                                                <button
                                                onClick={() => {
                                                    if (actionCount === 0) {
                                                        toast.error('Please add a comment or reject an image before sending back');
                                                        return;
                                                    }
                                                    handleRequestRevisionsClick(false);
                                                }}
                                                disabled={savingFeedback}
                                                className={`flex-[1.4] min-w-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-sm font-medium py-3 px-2 rounded-lg cursor-pointer transition-all border disabled:cursor-not-allowed hover:bg-[#dc2626] hover:border-[#dc2626] hover:text-white ${
                                                    actionCount > 0
                                                        ? 'bg-[#a6303a] border-[#a6303a] text-white'
                                                        : 'bg-[#18181b] border-[#38383d] text-zinc-300'
                                                }`}
                                            >
                                                {savingFeedback ? (
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                ) : (
                                                    <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
                                                )}
                                                Send Back ({actionCount} item{actionCount === 1 ? '' : 's'})
                                            </button>
                                            {allowFinalRevision && userRole === 'client' && (
                                                <button
                                                    onClick={() => {
                                                        if (actionCount === 0) {
                                                            toast.error('Please add a comment or reject an image before requesting a final revision');
                                                            return;
                                                        }
                                                        setShowFinalRevisionConfirm(true);
                                                    }}
                                                    disabled={savingFeedback}
                                                    className="flex-1 min-w-0 whitespace-nowrap flex items-center justify-center gap-1.5 text-sm font-medium py-3 px-2 rounded-lg cursor-pointer transition-all border border-[#a6303a] text-red-300 bg-transparent hover:bg-[#a6303a]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Send back for one last round — it then goes straight to scheduling instead of returning to you"
                                                >
                                                    <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
                                                    Final Revision
                                                </button>
                                            )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Drag-and-Drop Image Order Modal */}
                    <ImageOrderModal
                        open={showOrderModal}
                        onClose={() => setShowOrderModal(false)}
                        files={orderedThumbnails}
                        currentFileId={currentFile?.id}
                        onSelectFile={(f) => {
                            setCurrentFile(f as TaskFile);
                            setViewMode('single');
                        }}
                        onReorder={handleReorderImages}
                        isSaving={isSavingOrder}
                    />
                </TooltipProvider>
                <ImageCropDialog
                    open={showCrop}
                    onClose={() => !cropSaving && setShowCrop(false)}
                    imageUrl={currentFile.url}
                    fileName={currentFile.name}
                    mimeType={currentFile.mimeType}
                    saving={cropSaving}
                    onSave={handleCropSave}
                />
                <FinalRevisionConfirmDialog
                    open={showFinalRevisionConfirm}
                    onOpenChange={setShowFinalRevisionConfirm}
                    loading={savingFeedback}
                    onConfirm={async () => {
                        await handleRequestRevisionsClick(true);
                        setShowFinalRevisionConfirm(false);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}