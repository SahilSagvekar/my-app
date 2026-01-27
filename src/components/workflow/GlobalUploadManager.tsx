// components/workflow/GlobalUploadManager.tsx
"use client";

import { useState } from 'react';
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
    Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

export function GlobalUploadManager() {
    const { activeUploads, pauseUpload, cancelUpload, startUpload } = useUploads();
    const [isExpanded, setIsExpanded] = useState(false);

    if (activeUploads.length === 0) return null;

    const uploadingCount = activeUploads.filter(u => u.status === 'uploading').length;
    const completedCount = activeUploads.filter(u => u.status === 'completed').length;
    const failedCount = activeUploads.filter(u => u.status === 'failed').length;

    return (
        <div className={cn(
            "fixed bottom-4 right-4 z-[100] w-80 bg-white border shadow-2xl rounded-xl overflow-hidden transition-all duration-300",
            isExpanded ? "h-auto max-h-[400px]" : "h-14"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 h-14 bg-white border-b text-gray-900 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {uploadingCount > 0 ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    ) : failedCount > 0 ? (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                    ) : (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                    <span className="text-sm font-medium">
                        {uploadingCount > 0 ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? 's' : ''}` :
                            completedCount > 0 && uploadingCount === 0 ? 'Uploads complete' : 'Upload manager'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </div>
            </div>

            {/* Upload List */}
            {isExpanded && (
                <div className="overflow-y-auto max-h-[340px] p-2 space-y-2 bg-slate-50">
                    {activeUploads.map((upload) => {
                        const progress = Math.round((upload.uploadedBytes / upload.fileSize) * 100);

                        return (
                            <div key={upload.id} className="p-3 bg-white border rounded-lg shadow-sm space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                                            <Video className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold truncate" title={upload.fileName}>
                                                {upload.fileName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {(upload.fileSize / (1024 * 1024)).toFixed(1)} MB • {upload.subfolder || 'main'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {upload.status === 'uploading' && (
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => pauseUpload(upload.id)}>
                                                <Pause className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {/* {upload.status === 'paused' && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startUpload(null as any, null, '', upload.id)}>
                        <Play className="h-3 w-3" />
                      </Button>
                    )} */}
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => cancelUpload(upload.id)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className={cn(
                                            "font-medium",
                                            upload.status === 'completed' ? "text-green-600" :
                                                upload.status === 'failed' ? "text-red-600" :
                                                    "text-blue-600"
                                        )}>
                                            {upload.status === 'uploading' ? 'Uploading...' :
                                                upload.status === 'completed' ? 'Complete' :
                                                    upload.status === 'paused' ? 'Paused' :
                                                        upload.status === 'failed' ? 'Failed' : 'Pending'}
                                        </span>
                                        <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} className={cn(
                                        "h-1.5",
                                        upload.status === 'completed' ? "bg-green-100 [&>div]:bg-green-500" :
                                            upload.status === 'failed' ? "bg-red-100 [&>div]:bg-red-500" :
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
