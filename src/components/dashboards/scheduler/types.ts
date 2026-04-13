export type PlatformKey = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'linkedin' | 'twitter' | 'other';

export interface SchedulerTask {
    id: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    dueDate?: string;
    isTrial?: boolean;
    files: {
        id: string | number;
        name: string;
        url?: string;
        size: number;
        mimeType?: string;
        folderType?: string;
        s3Key?: string;
    }[];
    createdAt: string;
    clientId: string;
    client?: {
        id?: string;
        name: string;
        companyName?: string;
    };
    editor?: {
        id: number;
        name: string;
    };
    deliverable?: {
        id: string;
        type: string;
        quantity?: number;
        videosPerDay?: number;
        postingSchedule?: string;
        postingDays?: string[];
        postingTimes?: string[];
        platforms?: string[];
        description?: string;
        isOneOff?: boolean;
    };
    socialMediaLinks?: Array<{ platform: string; url: string; postedAt: string }>;
    // AI Titling fields
    suggestedTitles?: Array<{ style?: string; title: string; reasoning?: string }> | string[];
    titlingStatus?: string;
}

export interface ClientDeliverable {
    id: string;
    type: string;
    quantity: number;
    postingSchedule: string;
    postingDays: string[];
    postingTimes: string[];
    platforms: string[];
    description?: string;
    isOneOff?: boolean;
}
