// Review System Types
// Frame.io-style review system type definitions

export interface ReviewComment {
    id: string;
    taskId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    timestamp: string; // Video timestamp formatted "1:23"
    timestampSeconds: number; // Video timestamp in seconds
    endTimestamp?: string; // Optional end timestamp for ranges "1:28"
    endTimestampSeconds?: number; // Optional end timestamp in seconds for ranges
    content: string;
    category: 'design' | 'content' | 'timing' | 'technical' | 'other' | 'subtitles';

    screenshotUrl?: string; // Base64 or URL of captured video frame
    annotations?: Annotation[];

    replies?: ReviewComment[];
    resolved: boolean;
    version?: number; // Version number of the file when comment was made
    createdAt: Date;
    updatedAt?: Date;
}

// Deliverable type for aspect ratio handling
export type DeliverableType = 'LF' | 'SF' | 'SQF' | 'Long Form Videos' | 'Short Form Videos' | 'Square Form Videos' | string;

// Helper to get aspect ratio class based on deliverable type
export function getAspectRatioClass(deliverableType?: DeliverableType): string {
    if (!deliverableType) return 'aspect-video'; // Default to 16:9
    
    const normalized = deliverableType.toLowerCase().replace(/[_\s]/g, '');
    
    // Short Form (9:16 vertical)
    if (normalized === 'sf' || normalized === 'shortformvideos' || normalized === 'shortform') {
        return 'aspect-[9/16]';
    }
    
    // Square Form (1:1)
    if (normalized === 'sqf' || normalized === 'squareformvideos' || normalized === 'squareform') {
        return 'aspect-square';
    }
    
    // Long Form (16:9) - default
    return 'aspect-video';
}

// Helper to get container styles based on deliverable type
export function getVideoContainerStyles(deliverableType?: DeliverableType): { maxWidth: string; aspectClass: string } {
    if (!deliverableType) return { maxWidth: 'max-w-5xl', aspectClass: 'aspect-video' };
    
    const normalized = deliverableType.toLowerCase().replace(/[_\s]/g, '');
    
    // Short Form (9:16 vertical) - narrower container
    if (normalized === 'sf' || normalized === 'shortformvideos' || normalized === 'shortform') {
        return { maxWidth: 'max-w-sm', aspectClass: 'aspect-[9/16]' };
    }
    
    // Square Form (1:1) - medium container
    if (normalized === 'sqf' || normalized === 'squareformvideos' || normalized === 'squareform') {
        return { maxWidth: 'max-w-2xl', aspectClass: 'aspect-square' };
    }
    
    // Long Form (16:9) - wide container
    return { maxWidth: 'max-w-5xl', aspectClass: 'aspect-video' };
}

export interface Annotation {
    id: string;
    type: 'freehand' | 'arrow' | 'rectangle' | 'circle';
    points: { x: number; y: number }[];
    color: string;
    strokeWidth: number;
    timestampSeconds: number;
}

export interface ReviewStatus {
    value: 'needs_review' | 'in_progress' | 'needs_changes' | 'approved';
    label: string;
    color: string;
    bgClass: string;
}

export const REVIEW_STATUSES: ReviewStatus[] = [
    { value: 'needs_review', label: 'Needs Review', color: '#6b7280', bgClass: 'bg-gray-500' },
    { value: 'in_progress', label: 'In Progress', color: '#3b82f6', bgClass: 'bg-blue-500' },
    { value: 'needs_changes', label: 'Needs Changes', color: '#f97316', bgClass: 'bg-orange-500' },
    { value: 'approved', label: 'Approved', color: '#22c55e', bgClass: 'bg-green-500' },
];

export interface CommentCategory {
    value: 'design' | 'content' | 'timing' | 'technical' | 'other' | 'subtitles';
    label: string;
    color: string;
}

export const COMMENT_CATEGORIES: CommentCategory[] = [
    { value: 'design', label: 'Design', color: '#8b5cf6' },
    { value: 'content', label: 'Content', color: '#3b82f6' },
    { value: 'timing', label: 'Timing', color: '#f59e0b' },
    { value: 'technical', label: 'Technical', color: '#ef4444' },
    { value: 'other', label: 'Other', color: '#6b7280' },
    { value: 'subtitles', label: 'Subtitles', color: '#3b82f2' },
];

export type AnnotationTool = 'select' | 'freehand' | 'arrow' | 'rectangle' | 'circle';

export interface ReviewAssetExtended {
    id: string;
    title: string;
    subtitle?: string;
    videoUrl: string;
    thumbnail: string;
    runtime: string;
    status: 'draft' | 'in_qc' | 'client_review' | 'approved';
    reviewStatus: ReviewStatus['value'];
    client: string;
    platform: string;
    resolution: string;
    fileSize: string;
    uploader: string;
    uploadDate: string;
    versions: Version[];
    currentVersion: string;
    downloadEnabled: boolean;
    approvalLocked: boolean;
    comments: ReviewComment[];
}

export interface Version {
    id: string;
    number: string;
    thumbnail: string;
    duration: string;
    uploadDate: string;
    status: 'draft' | 'in_qc' | 'client_review' | 'approved';
}
