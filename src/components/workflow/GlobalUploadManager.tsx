// components/workflow/GlobalUploadManager.tsx
"use client";

import { useState, useEffect } from 'react';
import { useUploads } from './UploadContext';
import {
    X,
    ChevronUp,
    ChevronDown,
    CheckCircle,
    AlertCircle,
    Pause,
    Play,
    Video,
    Loader2,
    Trash2,
    FileIcon,
    ImageIcon,
    FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';

// ─── Format helpers ───

function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec <= 0) return '';
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function formatEta(seconds: number): string {
    if (seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 5) return 'A few seconds left';
    if (seconds < 60) return `${Math.round(seconds)} sec left`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return secs > 0 ? `${mins} min ${secs} sec left` : `${mins} min left`;
    }
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hrs}h ${mins}m left`;
}

function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(fileName: string) {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
        return <Video className="h-3.5 w-3.5" />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return <ImageIcon className="h-3.5 w-3.5" />;
    }
    if (['pdf'].includes(ext)) {
        return <FileText className="h-3.5 w-3.5" />;
    }
    return <FileIcon className="h-3.5 w-3.5" />;
}

export function GlobalUploadManager() {
    const { activeUploads, pauseUpload, cancelUpload, clearCompleted } = useUploads();
    const [isExpanded, setIsExpanded] = useState(false);
    const [prevCount, setPrevCount] = useState(0);

    // Auto-expand when a new upload starts
    useEffect(() => {
        if (activeUploads.length > prevCount) {
            setIsExpanded(true);
        }
        setPrevCount(activeUploads.length);
    }, [activeUploads.length, prevCount]);

    if (activeUploads.length === 0) return null;

    const uploadingCount = activeUploads.filter(u => u.status === 'uploading').length;
    const completedCount = activeUploads.filter(u => u.status === 'completed').length;
    const failedCount = activeUploads.filter(u => u.status === 'failed').length;
    const queuedCount = activeUploads.filter(u => u.status === 'queued').length;

    // Sort: uploading first, then queued, then paused, then completed, then failed
    const statusOrder: Record<string, number> = {
        uploading: 0, queued: 1, paused: 2, pending: 3, completed: 4, failed: 5
    };
    const sortedUploads = [...activeUploads].sort((a, b) =>
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    );

    // Header status text
    const headerText = uploadingCount > 0
        ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? 's' : ''}${queuedCount > 0 ? ` (${queuedCount} queued)` : ''}`
        : completedCount > 0 && failedCount === 0
            ? `${completedCount} upload${completedCount > 1 ? 's' : ''} complete`
            : failedCount > 0
                ? `${failedCount} upload${failedCount > 1 ? 's' : ''} failed`
                : 'Upload manager';

    return (
        <div className={cn(
            "fixed bottom-4 right-4 z-[100] w-96 bg-white border shadow-2xl rounded-xl overflow-hidden transition-all duration-300",
            isExpanded ? "h-auto max-h-[450px]" : "h-14"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 h-14 bg-white border-b text-gray-900 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {uploadingCount > 0 ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : failedCount > 0 ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-sm font-medium">{headerText}</span>
                </div>
                <div className="flex items-center gap-1">
                    {completedCount > 0 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                                e.stopPropagation();
                                clearCompleted();
                            }}
                        >
                            Clear done
                        </Button>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </div>
            </div>

            {/* Upload List */}
            {isExpanded && (
                <div className="overflow-y-auto max-h-[380px] p-2 space-y-2 bg-slate-50">
                    {sortedUploads.map((upload) => {
                        const progress = Math.round((upload.uploadedBytes / upload.fileSize) * 100);
                        const isActive = upload.status === 'uploading';
                        const isComplete = upload.status === 'completed';
                        const isFailed = upload.status === 'failed';

                        return (
                            <div key={upload.id} className={cn(
                                "p-3 border rounded-lg shadow-sm space-y-2",
                                isComplete ? "bg-green-50 border-green-200" :
                                isFailed ? "bg-red-50 border-red-200" :
                                "bg-white"
                            )}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={cn(
                                            "p-1.5 rounded",
                                            isComplete ? "bg-green-100 text-green-600" :
                                            isFailed ? "bg-red-100 text-red-600" :
                                            "bg-blue-50 text-blue-600"
                                        )}>
                                            {isComplete ? <CheckCircle className="h-3.5 w-3.5" /> :
                                             isFailed ? <AlertCircle className="h-3.5 w-3.5" /> :
                                             getFileIcon(upload.fileName)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate" title={upload.fileName}>
                                                {upload.fileName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatSize(upload.fileSize)}
                                                {upload.subfolder && upload.subfolder !== 'main' ? ` • ${upload.subfolder}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {upload.status === 'uploading' && (
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => pauseUpload(upload.id)}>
                                                <Pause className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {!isComplete && (
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => cancelUpload(upload.id)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    {/* Status + speed + ETA row */}
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className={cn(
                                            "font-medium",
                                            isComplete ? "text-green-600" :
                                            isFailed ? "text-red-600" :
                                            isActive ? "text-blue-600" :
                                            "text-muted-foreground"
                                        )}>
                                            {upload.status === 'uploading' ? 'Uploading...' :
                                                upload.status === 'completed' ? '✓ Complete' :
                                                upload.status === 'paused' ? 'Paused' :
                                                upload.status === 'queued' ? 'Queued' :
                                                upload.status === 'failed' ? 'Failed' : 'Pending'}
                                        </span>
                                        {isActive && upload.speed && upload.speed > 0 ? (
                                            <span className="text-muted-foreground">
                                                {formatSpeed(upload.speed)}
                                                {upload.estimatedTimeLeft && upload.estimatedTimeLeft > 0
                                                    ? ` — ${formatEta(upload.estimatedTimeLeft)}`
                                                    : ''
                                                }
                                            </span>
                                        ) : (
                                            <span>{isComplete ? '100%' : `${progress}%`}</span>
                                        )}
                                    </div>

                                    {/* Transferred size info for active uploads */}
                                    {isActive && (
                                        <p className="text-[10px] text-muted-foreground">
                                            {formatSize(upload.uploadedBytes)} of {formatSize(upload.fileSize)}
                                        </p>
                                    )}

                                    {/* Progress bar */}
                                    <Progress value={isComplete ? 100 : progress} className={cn(
                                        "h-1.5",
                                        isComplete ? "bg-green-100 [&>div]:bg-green-500" :
                                        isFailed ? "bg-red-100 [&>div]:bg-red-500" :
                                        ""
                                    )} />
                                </div>

                                {upload.error && (
                                    <p className="text-[9px] text-red-500 leading-tight">
                                        {upload.error}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}