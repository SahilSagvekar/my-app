// src/app/api/youtube/analytics/route.ts
// Smart caching: Returns cached data instantly, refreshes from YouTube API only when needed

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { fetchLiveYouTubeAnalytics } from "@/lib/youtube-sync-service";

// Cache TTL in milliseconds (6 hours)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let clientId = searchParams.get("clientId");
    const range = searchParams.get("range") || "28d";
    const forceRefresh = searchParams.get("refresh") === "true";

    // If user is a client, they can only see their own data
    if (user.role === 'client') {
      const client = await prisma.client.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Client profile not found" },
          { status: 404 }
        );
      }
      clientId = client.id;
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Get channel info
    const channel = await prisma.youTubeChannel.findUnique({
      where: { clientId },
    });

    if (!channel) {
      return NextResponse.json(
        { connected: false, data: null },
        { status: 200 }
      );
    }

    // Check for cached snapshot for this date range
    const cachedSnapshot = await prisma.youTubeSnapshot.findFirst({
      where: {
        channelId: channel.id,
        dateRange: range,
      },
    });

    const now = new Date();
    const cacheAge = cachedSnapshot
      ? now.getTime() - cachedSnapshot.snapshotDate.getTime()
      : Infinity;
    const cacheIsStale = cacheAge > CACHE_TTL_MS;

    // Determine if we need fresh data
    const needsFreshData = forceRefresh || !cachedSnapshot || cacheIsStale;

    let snapshotData = cachedSnapshot;

    if (needsFreshData) {
      console.log(`[YouTube Analytics] Fetching fresh data for range: ${range}, forceRefresh: ${forceRefresh}, cacheAge: ${Math.round(cacheAge / 1000 / 60)} min`);

      // Fetch live data from YouTube API
      const days = parseInt(range.replace("d", ""));
      const liveResult = await fetchLiveYouTubeAnalytics(clientId, days);

      if (liveResult.success && liveResult.data) {
        const analytics = liveResult.data;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Upsert the snapshot (create or update for this dateRange)
        snapshotData = await prisma.youTubeSnapshot.upsert({
          where: {
            channelId_dateRange: {
              channelId: channel.id,
              dateRange: range,
            },
          },
          create: {
            channelId: channel.id,
            clientId: clientId,
            dateRange: range,
            subscriberCount: analytics.subscriberCount,
            views: BigInt(analytics.views),
            watchTimeHours: analytics.watchTimeHours,
            estimatedRevenue: analytics.estimatedRevenue || null,
            likes: analytics.likes,
            comments: analytics.comments,
            shares: analytics.shares || 0,
            impressions: BigInt(analytics.impressions || 0),
            impressionsCtr: analytics.impressionsCtr || null,
            avgViewDuration: analytics.avgViewDuration || null,
            subscribersGained: analytics.subscribersGained,
            subscribersLost: analytics.subscribersLost,
            geographyData: analytics.geographyData || [],
            deviceData: analytics.deviceData || [],
            periodStart: startDate,
            periodEnd: endDate,
            periodType: 'DAILY',
            snapshotDate: new Date(),
          },
          update: {
            subscriberCount: analytics.subscriberCount,
            views: BigInt(analytics.views),
            watchTimeHours: analytics.watchTimeHours,
            estimatedRevenue: analytics.estimatedRevenue || null,
            likes: analytics.likes,
            comments: analytics.comments,
            shares: analytics.shares || 0,
            impressions: BigInt(analytics.impressions || 0),
            impressionsCtr: analytics.impressionsCtr || null,
            avgViewDuration: analytics.avgViewDuration || null,
            subscribersGained: analytics.subscribersGained,
            subscribersLost: analytics.subscribersLost,
            geographyData: analytics.geographyData || [],
            deviceData: analytics.deviceData || [],
            periodStart: startDate,
            periodEnd: endDate,
            snapshotDate: new Date(),
          },
        });

        // Update channel's last sync time
        await prisma.youTubeChannel.update({
          where: { id: channel.id },
          data: {
            lastSyncedAt: new Date(),
            syncStatus: 'COMPLETED',
            subscriberCount: analytics.subscriberCount,
          },
        });
      } else if (!cachedSnapshot) {
        // No cache and failed to fetch - return error
        return NextResponse.json({
          connected: true,
          error: liveResult.error || "Failed to fetch YouTube data",
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          channelAvatar: channel.channelAvatar,
          currentSubscribers: channel.subscriberCount,
          subscriberChange: 0,
          viewsInPeriod: 0,
          watchTimeHours: 0,
          estimatedRevenue: null,
          avgViewDuration: null,
          totalLikes: 0,
          totalComments: 0,
          distribution: null,
          topVideos: [],
          dailyData: [],
          lastSyncedAt: channel.lastSyncedAt?.toISOString() || null,
          syncStatus: 'FAILED',
        });
      }
      // If cache exists but refresh failed, continue with cache data
    } else {
      console.log(`[YouTube Analytics] Using cached data for range: ${range}, age: ${Math.round(cacheAge / 1000 / 60)} min`);
    }

    // Fetch top videos
    const topVideos = await prisma.youTubeVideoStat.findMany({
      where: { channelId: channel.id },
      orderBy: { views: "desc" },
      take: 10,
    });

    // Build response from snapshot data
    const response = {
      connected: true,
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      channelAvatar: channel.channelAvatar,
      currentSubscribers: snapshotData?.subscriberCount || channel.subscriberCount,
      subscriberChange: (snapshotData?.subscribersGained || 0) - (snapshotData?.subscribersLost || 0),
      totalViews: Number(channel.totalViews),
      viewsInPeriod: Number(snapshotData?.views || 0),
      watchTimeHours: Math.round((snapshotData?.watchTimeHours || 0) * 10) / 10,
      estimatedRevenue: snapshotData?.estimatedRevenue
        ? Math.round(snapshotData.estimatedRevenue * 100) / 100
        : null,
      avgViewDuration: snapshotData?.avgViewDuration || null,
      totalLikes: snapshotData?.likes || 0,
      totalComments: snapshotData?.comments || 0,
      distribution: {
        geography: snapshotData?.geographyData || [],
        device: snapshotData?.deviceData || [],
      },
      topVideos: topVideos.map((v) => ({
        id: v.videoId,
        title: v.title,
        publishedAt: v.publishedAt.toISOString(),
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        views: Number(v.views),
        likes: v.likes,
        comments: v.comments,
        watchTimeHours: v.watchTimeHours,
        estimatedRevenue: v.estimatedRevenue,
      })),
      dailyData: [], // Single snapshot doesn't have daily breakdown
      lastSyncedAt: snapshotData?.snapshotDate?.toISOString() || channel.lastSyncedAt?.toISOString() || null,
      syncStatus: channel.syncStatus,
      cacheAge: Math.round(cacheAge / 1000 / 60), // Age in minutes for debugging
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[YouTube Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}