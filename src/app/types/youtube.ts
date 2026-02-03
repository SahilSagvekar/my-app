// src/types/youtube.ts

export interface YouTubeTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnail: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

export interface YouTubeAnalyticsRow {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
  estimatedRevenue?: number;
  impressions?: number;
  impressionClickThroughRate?: number;
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
}

export interface ChannelOverview {
  channelId: string;
  channelTitle: string;
  channelAvatar: string;
  currentSubscribers: number;
  subscriberChange: number;
  totalViews: number;
  viewsInPeriod: number;
  watchTimeHours: number;
  estimatedRevenue: number | null;
  impressions: number;
  impressionsCtr: number | null;
  avgViewDuration: number | null;
  topVideos: YouTubeVideoItem[];
  dailyData: DailyMetric[];
  lastSyncedAt: string | null;
}

export interface DailyMetric {
  date: string;
  views: number;
  watchTimeHours: number;
  subscribers: number;
  subscribersGained: number;
  subscribersLost: number;
  likes: number;
  comments: number;
  estimatedRevenue?: number;
}

export interface AdminClientYouTube {
  clientId: string;
  clientName: string;
  companyName: string | null;
  channelTitle: string;
  channelAvatar: string;
  currentSubscribers: number;
  subscriberChange: number;
  viewsInPeriod: number;
  watchTimeHours: number;
  estimatedRevenue: number | null;
  lastSyncedAt: string | null;
  syncStatus: string;
  isConnected: boolean;
}

export type DateRange = "7d" | "28d" | "90d" | "365d";