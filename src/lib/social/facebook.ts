// src/lib/social/facebook.ts
// Facebook Page Service - Fetches page stats, posts, and insights via Meta Graph API

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

export interface FacebookPageStats {
  followers: number;
  likes: number;
  followersGained?: number;
  impressions?: number;
  reach?: number;
  engagementRate?: number;
  views?: number;
}

export interface FacebookPost {
  id: string;
  type: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  url: string;
  publishedAt: string;
  views?: number;
  likes: number;
  comments: number;
  shares: number;
  reach?: number;
  impressions?: number;
  engagementRate?: number;
}

export class FacebookService {
  private accessToken: string;
  private pageId?: string;
  private pageAccessToken?: string;

  constructor(accessToken: string, pageId?: string, pageAccessToken?: string) {
    this.accessToken = accessToken;
    this.pageId = pageId;
    this.pageAccessToken = pageAccessToken || accessToken;
  }

  /**
   * Get list of Facebook Pages the user manages
   */
  async getPages(): Promise<Array<{
    id: string;
    name: string;
    accessToken: string;
    category: string;
    picture?: string;
  }>> {
    const res = await fetch(
      `${META_GRAPH_URL}/me/accounts?fields=id,name,access_token,category,picture&access_token=${this.accessToken}`
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to fetch pages: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.data?.map((page: any) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      category: page.category,
      picture: page.picture?.data?.url,
    })) || [];
  }

  /**
   * Get page basic info and follower count
   */
  async getPageInfo(): Promise<{
    id: string;
    name: string;
    username?: string;
    picture?: string;
    followers: number;
    likes: number;
    category: string;
    website?: string;
  }> {
    if (!this.pageId) throw new Error('Page ID not set');

    const res = await fetch(
      `${META_GRAPH_URL}/${this.pageId}?fields=id,name,username,picture,followers_count,fan_count,category,website&access_token=${this.pageAccessToken}`
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to fetch page info: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      username: data.username,
      picture: data.picture?.data?.url,
      followers: data.followers_count || 0,
      likes: data.fan_count || 0,
      category: data.category,
      website: data.website,
    };
  }

  /**
   * Get account stats (followers, engagement, etc.)
   */
  async getAccountStats(): Promise<FacebookPageStats> {
    if (!this.pageId) throw new Error('Page ID not set');

    // Get basic page info
    const pageInfo = await this.getPageInfo();

    // Get page insights for last 28 days
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (28 * 24 * 60 * 60);

    const metrics = [
      'page_impressions',
      'page_impressions_unique', // reach
      'page_post_engagements',
      'page_fans', // total likes
      'page_fan_adds', // new likes
      'page_views_total',
    ].join(',');

    const res = await fetch(
      `${META_GRAPH_URL}/${this.pageId}/insights?metric=${metrics}&period=day&since=${startDate}&until=${endDate}&access_token=${this.pageAccessToken}`
    );

    let insights: any = { data: [] };
    if (res.ok) {
      insights = await res.json();
    }

    // Aggregate insights
    let totalImpressions = 0;
    let totalReach = 0;
    let totalEngagement = 0;
    let totalViews = 0;
    let followersGained = 0;

    insights.data?.forEach((metric: any) => {
      const values = metric.values || [];
      const total = values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);

      switch (metric.name) {
        case 'page_impressions':
          totalImpressions = total;
          break;
        case 'page_impressions_unique':
          totalReach = total;
          break;
        case 'page_post_engagements':
          totalEngagement = total;
          break;
        case 'page_views_total':
          totalViews = total;
          break;
        case 'page_fan_adds':
          followersGained = total;
          break;
      }
    });

    // Calculate engagement rate
    const engagementRate = totalReach > 0 
      ? (totalEngagement / totalReach) * 100 
      : 0;

    return {
      followers: pageInfo.followers,
      likes: pageInfo.likes,
      followersGained,
      impressions: totalImpressions,
      reach: totalReach,
      views: totalViews,
      engagementRate: Math.round(engagementRate * 100) / 100,
    };
  }

  /**
   * Get recent posts with engagement metrics
   */
  async getRecentPosts(limit = 50): Promise<FacebookPost[]> {
    if (!this.pageId) throw new Error('Page ID not set');

    // Fetch recent posts
    const res = await fetch(
      `${META_GRAPH_URL}/${this.pageId}/posts?fields=id,message,story,created_time,permalink_url,full_picture,type,shares,attachments{media_type,title,description,url}&limit=${limit}&access_token=${this.pageAccessToken}`
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to fetch posts: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const posts = data.data || [];

    // Fetch engagement for each post
    const postsWithStats = await Promise.all(
      posts.map(async (post: any) => {
        try {
          // Get reactions, comments count
          const engagementRes = await fetch(
            `${META_GRAPH_URL}/${post.id}?fields=reactions.summary(true),comments.summary(true)&access_token=${this.pageAccessToken}`
          );

          let likes = 0;
          let comments = 0;

          if (engagementRes.ok) {
            const engData = await engagementRes.json();
            likes = engData.reactions?.summary?.total_count || 0;
            comments = engData.comments?.summary?.total_count || 0;
          }

          // Try to get post insights (may fail for some post types)
          let reach = 0;
          let impressions = 0;

          try {
            const insightsRes = await fetch(
              `${META_GRAPH_URL}/${post.id}/insights?metric=post_impressions,post_impressions_unique&access_token=${this.pageAccessToken}`
            );

            if (insightsRes.ok) {
              const insightsData = await insightsRes.json();
              insightsData.data?.forEach((m: any) => {
                if (m.name === 'post_impressions') impressions = m.values?.[0]?.value || 0;
                if (m.name === 'post_impressions_unique') reach = m.values?.[0]?.value || 0;
              });
            }
          } catch (e) {
            // Insights not available for all posts
          }

          const shares = post.shares?.count || 0;

          return {
            id: post.id,
            type: post.type || post.attachments?.data?.[0]?.media_type || 'status',
            title: post.attachments?.data?.[0]?.title || null,
            description: post.message || post.story || null,
            thumbnail: post.full_picture || null,
            url: post.permalink_url,
            publishedAt: post.created_time,
            likes,
            comments,
            shares,
            reach,
            impressions,
            engagementRate: reach > 0 ? ((likes + comments + shares) / reach) * 100 : 0,
          };
        } catch (e) {
          // Return basic post data if engagement fetch fails
          return {
            id: post.id,
            type: post.type || 'status',
            title: null,
            description: post.message || post.story || null,
            thumbnail: post.full_picture || null,
            url: post.permalink_url,
            publishedAt: post.created_time,
            likes: 0,
            comments: 0,
            shares: post.shares?.count || 0,
          };
        }
      })
    );

    return postsWithStats;
  }

  /**
   * Get page demographics/audience insights
   */
  async getAudienceDemographics(): Promise<{
    genderAge?: Record<string, number>;
    countries?: Record<string, number>;
    cities?: Record<string, number>;
    locales?: Record<string, number>;
  }> {
    if (!this.pageId) throw new Error('Page ID not set');

    const metrics = [
      'page_fans_gender_age',
      'page_fans_country',
      'page_fans_city',
      'page_fans_locale',
    ].join(',');

    const res = await fetch(
      `${META_GRAPH_URL}/${this.pageId}/insights?metric=${metrics}&period=lifetime&access_token=${this.pageAccessToken}`
    );

    if (!res.ok) {
      return {};
    }

    const data = await res.json();
    const result: any = {};

    data.data?.forEach((metric: any) => {
      const value = metric.values?.[0]?.value || {};
      switch (metric.name) {
        case 'page_fans_gender_age':
          result.genderAge = value;
          break;
        case 'page_fans_country':
          result.countries = value;
          break;
        case 'page_fans_city':
          result.cities = value;
          break;
        case 'page_fans_locale':
          result.locales = value;
          break;
      }
    });

    return result;
  }

  /**
   * Get daily page insights for charts
   */
  async getDailyInsights(days = 28): Promise<Array<{
    date: string;
    impressions: number;
    reach: number;
    engagement: number;
    fans: number;
  }>> {
    if (!this.pageId) throw new Error('Page ID not set');

    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (days * 24 * 60 * 60);

    const metrics = [
      'page_impressions',
      'page_impressions_unique',
      'page_post_engagements',
      'page_fans',
    ].join(',');

    const res = await fetch(
      `${META_GRAPH_URL}/${this.pageId}/insights?metric=${metrics}&period=day&since=${startDate}&until=${endDate}&access_token=${this.pageAccessToken}`
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    
    // Group by date
    const byDate = new Map<string, any>();

    data.data?.forEach((metric: any) => {
      metric.values?.forEach((v: any) => {
        const date = v.end_time.split('T')[0];
        if (!byDate.has(date)) {
          byDate.set(date, { date, impressions: 0, reach: 0, engagement: 0, fans: 0 });
        }
        const entry = byDate.get(date)!;
        
        switch (metric.name) {
          case 'page_impressions':
            entry.impressions = v.value || 0;
            break;
          case 'page_impressions_unique':
            entry.reach = v.value || 0;
            break;
          case 'page_post_engagements':
            entry.engagement = v.value || 0;
            break;
          case 'page_fans':
            entry.fans = v.value || 0;
            break;
        }
      });
    });

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    // Facebook Page tokens from me/accounts are long-lived and don't expire
    // But user tokens need to be exchanged for long-lived tokens
    const res = await fetch(
      `${META_GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${refreshToken}`
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to refresh token: ${err.error?.message || res.statusText}`);
    }

    return res.json();
  }
}