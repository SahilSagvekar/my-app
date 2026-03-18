// src/lib/social/youtube.ts

import { google } from 'googleapis';

export class YouTubeService {
  private youtube;
  private analytics;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    this.youtube = google.youtube({ version: 'v3', auth });
    this.analytics = google.youtubeAnalytics({ version: 'v2', auth });
  }

  async getAccountStats() {
    // Get channel info
    const channelRes = await this.youtube.channels.list({
      part: ['statistics', 'snippet'],
      mine: true,
    });

    const channel = channelRes.data.items?.[0];
    if (!channel) throw new Error('No channel found');

    const stats = channel.statistics!;

    // Get analytics for last 28 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const analyticsRes = await this.analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,likes,comments,shares,subscribersGained,subscribersLost',
    });

    const row = analyticsRes.data.rows?.[0] || [];

    return {
      followers: parseInt(stats.subscriberCount || '0'),
      followersGained: row[4] || 0,
      followersLost: row[5] || 0,
      views: row[0] || 0,
      likes: row[1] || 0,
      comments: row[2] || 0,
      shares: row[3] || 0,
    };
  }

  async getRecentPosts(limit = 50) {
    const res = await this.youtube.search.list({
      part: ['snippet'],
      forMine: true,
      type: ['video'],
      maxResults: limit,
      order: 'date',
    });

    const videoIds = res.data.items?.map(item => item.id?.videoId!).filter(Boolean) || [];
    
    if (videoIds.length === 0) return [];

    const statsRes = await this.youtube.videos.list({
      part: ['statistics', 'contentDetails'],
      id: videoIds,
    });

    return res.data.items?.map((item, i) => {
      const stats = statsRes.data.items?.[i]?.statistics;
      return {
        id: item.id?.videoId!,
        type: 'video',
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnail: item.snippet?.thumbnails?.high?.url,
        url: `https://youtube.com/watch?v=${item.id?.videoId}`,
        publishedAt: item.snippet?.publishedAt,
        views: parseInt(stats?.viewCount || '0'),
        likes: parseInt(stats?.likeCount || '0'),
        comments: parseInt(stats?.commentCount || '0'),
        shares: 0, // Not available in basic stats
      };
    }) || [];
  }

  async refreshToken(refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_YOUTUBE_CLIENT_ID,
      process.env.GOOGLE_YOUTUBE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      access_token: credentials.access_token!,
      expires_in: credentials.expiry_date 
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600,
    };
  }
}