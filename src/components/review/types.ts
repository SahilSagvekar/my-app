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
    content: string;
    category: 'design' | 'content' | 'timing' | 'technical' | 'other';
    annotations?: Annotation[];
    replies?: ReviewComment[];
    resolved: boolean;
    createdAt: Date;
    updatedAt?: Date;
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
    value: 'design' | 'content' | 'timing' | 'technical' | 'other';
    label: string;
    color: string;
}

export const COMMENT_CATEGORIES: CommentCategory[] = [
    { value: 'design', label: 'Design', color: '#8b5cf6' },
    { value: 'content', label: 'Content', color: '#3b82f6' },
    { value: 'timing', label: 'Timing', color: '#f59e0b' },
    { value: 'technical', label: 'Technical', color: '#ef4444' },
    { value: 'other', label: 'Other', color: '#6b7280' },
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
