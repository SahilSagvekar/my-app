// src/app/api/youtube/analytics/route.ts
// Serves YouTube analytics data from DB (no YouTube API calls on page load)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // TODO: Add your auth check
    // const session = await getServerSession(authOptions);

    const clientId = req.nextUrl.searchParams.get("clientId");
    const range = req.nextUrl.searchParams.get("range") || "28d"; // 7d, 28d, 90d, 365d

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Get channel
    const channel = await prisma.youTubeChannel.findUnique({
      where: { clientId },
    });

    if (!channel) {
      return NextResponse.json(
        { connected: false, data: null },
        { status: 200 }
      );
    }

    // Calculate date range
    const days = parseInt(range.replace("d", ""));
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Fetch snapshots for the period
    const snapshots = await prisma.youTubeSnapshot.findMany({
      where: {
        channelId: channel.id,
        periodStart: { gte: startDate },
        periodType: "DAILY",
      },
      orderBy: { periodStart: "asc" },
    });

    // Fetch top videos
    const topVideos = await prisma.youTubeVideoStat.findMany({
      where: { channelId: channel.id },
      orderBy: { views: "desc" },
      take: 10,
    });

    // Aggregate stats for the period
    const totalViews = snapshots.reduce(
      (sum, s) => sum + Number(s.views),
      0
    );
    const totalWatchTime = snapshots.reduce(
      (sum, s) => sum + s.watchTimeHours,
      0
    );
    const totalRevenue = snapshots.reduce(
      (sum, s) => sum + (s.estimatedRevenue || 0),
      0
    );
    const totalSubsGained = snapshots.reduce(
      (sum, s) => sum + s.subscribersGained,
      0
    );
    const totalSubsLost = snapshots.reduce(
      (sum, s) => sum + s.subscribersLost,
      0
    );
    const totalLikes = snapshots.reduce((sum, s) => sum + s.likes, 0);
    const totalComments = snapshots.reduce(
      (sum, s) => sum + s.comments,
      0
    );

    // Format daily data for charts
    const dailyData = snapshots.map((s) => ({
      date: s.periodStart.toISOString().split("T")[0],
      views: Number(s.views),
      watchTimeHours: Math.round(s.watchTimeHours * 10) / 10,
      subscribers:
        s.subscriberCount || channel.subscriberCount,
      subscribersGained: s.subscribersGained,
      subscribersLost: s.subscribersLost,
      likes: s.likes,
      comments: s.comments,
      estimatedRevenue: s.estimatedRevenue
        ? Math.round(s.estimatedRevenue * 100) / 100
        : undefined,
    }));

    // Calculate avg view duration across the period
    const avgDurations = snapshots
      .filter((s) => s.avgViewDuration != null)
      .map((s) => s.avgViewDuration!);
    const avgViewDuration =
      avgDurations.length > 0
        ? avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length
        : null;

    // Serialize BigInt values before sending
    const response = {
      connected: true,
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      channelAvatar: channel.channelAvatar,
      currentSubscribers: channel.subscriberCount,
      subscriberChange: totalSubsGained - totalSubsLost,
      totalViews: Number(channel.totalViews),
      viewsInPeriod: totalViews,
      watchTimeHours: Math.round(totalWatchTime * 10) / 10,
      estimatedRevenue: totalRevenue > 0 ? Math.round(totalRevenue * 100) / 100 : null,
      avgViewDuration,
      totalLikes,
      totalComments,
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
      dailyData,
      lastSyncedAt: channel.lastSyncedAt?.toISOString() || null,
      syncStatus: channel.syncStatus,
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