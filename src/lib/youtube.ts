// src/lib/youtube.ts
// YouTube API Service - handles Data API v3 + Analytics API

import { prisma } from "@/lib/prisma";

const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(
  channelDbId: string
): Promise<string> {
  const channel = await prisma.youTubeChannel.findUnique({
    where: { id: channelDbId },
  });

  if (!channel) throw new Error("Channel not found");

  // If token is still valid (with 5 min buffer), return it
  if (channel.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return channel.accessToken;
  }

  // Refresh the token
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_YOUTUBE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_YOUTUBE_CLIENT_SECRET!,
      refresh_token: channel.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Token refresh failed:", err);

    // Mark channel as failed
    await prisma.youTubeChannel.update({
      where: { id: channelDbId },
      data: { syncStatus: "FAILED", syncError: "Token refresh failed" },
    });

    throw new Error("Failed to refresh YouTube token");
  }

  const tokens = await res.json();

  // Update stored tokens
  await prisma.youTubeChannel.update({
    where: { id: channelDbId },
    data: {
      accessToken: tokens.access_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      // refresh_token is only returned on first auth, not on refresh
      ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
    },
  });

  return tokens.access_token;
}

// ============================================================================
// YOUTUBE DATA API v3
// ============================================================================

/**
 * Fetch channel info (subscribers, total views, video count, avatar)
 */
export async function fetchChannelInfo(accessToken: string, channelId: string) {
  const res = await fetch(
    `${YOUTUBE_DATA_API}/channels?part=snippet,statistics&id=${channelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Channel info fetch failed: ${res.status}`);

  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) throw new Error("Channel not found");

  return {
    id: ch.id,
    title: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails?.medium?.url || "",
    subscriberCount: parseInt(ch.statistics.subscriberCount || "0"),
    viewCount: parseInt(ch.statistics.viewCount || "0"),
    videoCount: parseInt(ch.statistics.videoCount || "0"),
  };
}

/**
 * Fetch recent videos with their stats
 */
export async function fetchRecentVideos(
  accessToken: string,
  channelId: string,
  maxResults = 20
) {
  // Step 1: Search for recent uploads
  const searchRes = await fetch(
    `${YOUTUBE_DATA_API}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) throw new Error("Video search failed");
  const searchData = await searchRes.json();

  const videoIds = searchData.items
    .map((item: any) => item.id.videoId)
    .filter(Boolean)
    .join(",");

  if (!videoIds) return [];

  // Step 2: Get video details + stats
  const videosRes = await fetch(
    `${YOUTUBE_DATA_API}/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!videosRes.ok) throw new Error("Video details fetch failed");
  const videosData = await videosRes.json();

  return videosData.items.map((v: any) => ({
    id: v.id,
    title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    thumbnailUrl: v.snippet.thumbnails?.medium?.url || "",
    duration: parseDuration(v.contentDetails.duration),
    views: parseInt(v.statistics.viewCount || "0"),
    likes: parseInt(v.statistics.likeCount || "0"),
    comments: parseInt(v.statistics.commentCount || "0"),
  }));
}

// ============================================================================
// YOUTUBE ANALYTICS API
// ============================================================================

/**
 * Fetch daily analytics for a channel over a date range
 */
export async function fetchChannelAnalytics(
  accessToken: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
) {
  const metrics = [
    "views",
    "estimatedMinutesWatched",
    "averageViewDuration",
    "likes",
    "comments",
    "shares",
    "subscribersGained",
    "subscribersLost",
  ].join(",");

  // Try with revenue first (only works for monetized channels)
  const metricsWithRevenue = metrics + ",estimatedRevenue";

  let url =
    `${YOUTUBE_ANALYTICS_API}/reports?` +
    `ids=channel==MINE&` +
    `startDate=${startDate}&` +
    `endDate=${endDate}&` +
    `metrics=${metricsWithRevenue}&` +
    `dimensions=day&` +
    `sort=day`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // If revenue fails (not monetized), try without it
  if (!res.ok) {
    url =
      `${YOUTUBE_ANALYTICS_API}/reports?` +
      `ids=channel==MINE&` +
      `startDate=${startDate}&` +
      `endDate=${endDate}&` +
      `metrics=${metrics}&` +
      `dimensions=day&` +
      `sort=day`;

    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Analytics fetch failed: ${err}`);
  }

  const data = await res.json();
  const headers = data.columnHeaders.map((h: any) => h.name);

  return (data.rows || []).map((row: any[]) => {
    const obj: any = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

// ============================================================================
// SYNC LOGIC - Called by cron or manual refresh
// ============================================================================

/**
 * Full sync for a single channel - fetches all data and stores in DB
 */
export async function syncChannel(channelDbId: string) {
  try {
    // Mark as syncing
    await prisma.youTubeChannel.update({
      where: { id: channelDbId },
      data: { syncStatus: "SYNCING", syncError: null },
    });

    const channel = await prisma.youTubeChannel.findUnique({
      where: { id: channelDbId },
    });

    if (!channel || !channel.isActive) return;

    // Get fresh access token
    const accessToken = await refreshAccessToken(channelDbId);

    // 1. Fetch channel info (subscribers, total views)
    const channelInfo = await fetchChannelInfo(accessToken, channel.channelId);

    // 2. Fetch analytics for last 28 days
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const analytics = await fetchChannelAnalytics(
      accessToken,
      startDate,
      endDate
    );

    // 3. Fetch recent videos
    const videos = await fetchRecentVideos(
      accessToken,
      channel.channelId,
      20
    );

    // 4. Update channel info
    await prisma.youTubeChannel.update({
      where: { id: channelDbId },
      data: {
        channelTitle: channelInfo.title,
        channelAvatar: channelInfo.thumbnail,
        subscriberCount: channelInfo.subscriberCount,
        totalViews: BigInt(channelInfo.viewCount),
        totalVideos: channelInfo.videoCount,
        lastSyncedAt: new Date(),
        syncStatus: "COMPLETED",
        syncError: null,
      },
    });

    // 5. Upsert daily snapshots
    for (const day of analytics) {
      const date = new Date(day.day);
      const periodStart = new Date(date.setHours(0, 0, 0, 0));
      const periodEnd = new Date(date.setHours(23, 59, 59, 999));

      await prisma.youTubeSnapshot.upsert({
        where: {
          channelId_periodStart_periodEnd_periodType: {
            channelId: channel.id,
            periodStart,
            periodEnd,
            periodType: "DAILY",
          },
        },
        update: {
          views: BigInt(day.views || 0),
          watchTimeHours: (day.estimatedMinutesWatched || 0) / 60,
          likes: day.likes || 0,
          comments: day.comments || 0,
          shares: day.shares || 0,
          subscribersGained: day.subscribersGained || 0,
          subscribersLost: day.subscribersLost || 0,
          estimatedRevenue: day.estimatedRevenue ?? null,
          avgViewDuration: day.averageViewDuration ?? null,
        },
        create: {
          channelId: channel.id,
          clientId: channel.clientId,
          subscriberCount: channelInfo.subscriberCount,
          views: BigInt(day.views || 0),
          watchTimeHours: (day.estimatedMinutesWatched || 0) / 60,
          likes: day.likes || 0,
          comments: day.comments || 0,
          shares: day.shares || 0,
          subscribersGained: day.subscribersGained || 0,
          subscribersLost: day.subscribersLost || 0,
          estimatedRevenue: day.estimatedRevenue ?? null,
          avgViewDuration: day.averageViewDuration ?? null,
          periodStart,
          periodEnd,
          periodType: "DAILY",
        },
      });
    }

    // 6. Upsert video stats
    for (const video of videos) {
      await prisma.youTubeVideoStat.upsert({
        where: {
          channelId_videoId: {
            channelId: channel.id,
            videoId: video.id,
          },
        },
        update: {
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          views: BigInt(video.views),
          likes: video.likes,
          comments: video.comments,
          lastUpdated: new Date(),
        },
        create: {
          channelId: channel.id,
          videoId: video.id,
          title: video.title,
          publishedAt: new Date(video.publishedAt),
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          views: BigInt(video.views),
          likes: video.likes,
          comments: video.comments,
        },
      });
    }

    console.log(`[YouTube Sync] Completed for ${channelInfo.title}`);
    return { success: true, channelTitle: channelInfo.title };
  } catch (error: any) {
    console.error(`[YouTube Sync] Failed for channel ${channelDbId}:`, error);

    await prisma.youTubeChannel.update({
      where: { id: channelDbId },
      data: {
        syncStatus: "FAILED",
        syncError: error.message?.slice(0, 500),
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Sync ALL active channels - called by cron
 */
export async function syncAllChannels() {
  const channels = await prisma.youTubeChannel.findMany({
    where: { isActive: true },
  });

  console.log(`[YouTube Sync] Starting sync for ${channels.length} channels`);

  const results = [];
  for (const channel of channels) {
    // Add a small delay between channels to respect rate limits
    await new Promise((r) => setTimeout(r, 1000));
    const result = await syncChannel(channel.id);
    results.push({ channelId: channel.id, ...result });
  }

  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds
 */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get date string N days ago in YYYY-MM-DD format
 */
export function getDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}