// src/types/meta.ts

export interface MetaProfile {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
}

export interface MetaMedia {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    timestamp: string;
    like_count: number;
    comments_count: number;
    insights?: {
        engagement?: number;
        impressions?: number;
        reach?: number;
        saved?: number;
        video_views?: number;
    };
}

export interface MetaAnalyticsData {
    connected: boolean;
    instagramId?: string;
    username?: string;
    profilePicture?: string;
    followerCount: number;
    followersGained: number;
    impressions: number;
    reach: number;
    engagementRate: number;
    profileViews: number;
    websiteClicks: number;
    lastSyncedAt: string | null;
    syncStatus: string;
    topPosts: MetaMedia[];
    demographics?: {
        audience_gender_age?: any;
        audience_country?: any;
        audience_city?: any;
    };
    revenue?: {
        total: number;
        period: string;
    };
}

export interface MetaSnapshotData {
    impressions: number;
    reach: number;
    profileViews: number;
    websiteClicks: number;
    followerCount: number;
    followersGained: number;
    engagement: number;
    topPosts: any;
    demographics: any;
}
