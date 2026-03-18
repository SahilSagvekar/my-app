// src/lib/social/instagram.ts

export class InstagramService {
  private accessToken: string;
  private baseUrl = 'https://graph.instagram.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccountStats() {
    // Get basic account info
    const accountRes = await fetch(
      `${this.baseUrl}/me?fields=id,username,account_type,media_count,followers_count&access_token=${this.accessToken}`
    );
    const account = await accountRes.json();

    // Get insights (requires Instagram Business/Creator account)
    const insightsRes = await fetch(
      `${this.baseUrl}/${account.id}/insights?metric=impressions,reach,profile_views&period=day&access_token=${this.accessToken}`
    );
    const insights = await insightsRes.json();

    return {
      followers: account.followers_count || 0,
      followersGained: 0, // Need to track over time
      impressions: insights.data?.[0]?.values?.[0]?.value || 0,
      reach: insights.data?.[1]?.values?.[0]?.value || 0,
    };
  }

  async getRecentPosts(limit = 50) {
    const res = await fetch(
      `${this.baseUrl}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${this.accessToken}`
    );
    const data = await res.json();

    return data.data?.map((post: any) => ({
      id: post.id,
      type: post.media_type.toLowerCase(),
      title: null,
      description: post.caption,
      thumbnail: post.thumbnail_url || post.media_url,
      url: post.permalink,
      publishedAt: post.timestamp,
      views: 0, // Only for Reels
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      shares: 0,
    })) || [];
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch(
      `${this.baseUrl}/refresh_access_token?grant_type=ig_refresh_token&access_token=${this.accessToken}`
    );
    return res.json();
  }
}