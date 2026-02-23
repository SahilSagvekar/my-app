// src/app/api/youtube/admin-analytics/route.ts
// Admin-only: returns YouTube data for ALL clients

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Auth check - admin only
    const user = await getCurrentUser2(req);
    if (!user || user.role?.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const range = req.nextUrl.searchParams.get("range") || "28d";
    const days = parseInt(range.replace("d", ""));
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get all clients with their YouTube channels (status is lowercase 'active')
    const clients = await prisma.client.findMany({
      where: { status: "active" },
      include: {
        youtubeChannel: true,
      },
      orderBy: { name: "asc" },
    });

    const clientsData = await Promise.all(
      clients.map(async (client) => {
        const channel = client.youtubeChannel;

        if (!channel) {
          return {
            clientId: client.id,
            clientName: client.name,
            companyName: client.companyName,
            isConnected: false,
            channelTitle: null,
            channelAvatar: null,
            currentSubscribers: 0,
            subscriberChange: 0,
            viewsInPeriod: 0,
            watchTimeHours: 0,
            estimatedRevenue: null,
            lastSyncedAt: null,
            syncStatus: null,
          };
        }

        // Get aggregated stats for the period - use snapshotDate for filtering
        const snapshots = await prisma.youTubeSnapshot.findMany({
          where: {
            channelId: channel.id,
            snapshotDate: { gte: startDate },  // Changed from periodStart to snapshotDate
            periodType: "DAILY",
          },
        });

        const viewsInPeriod = snapshots.reduce(
          (sum, s) => sum + Number(s.views),
          0
        );
        const watchTimeHours = snapshots.reduce(
          (sum, s) => sum + s.watchTimeHours,
          0
        );
        const revenue = snapshots.reduce(
          (sum, s) => sum + (s.estimatedRevenue || 0),
          0
        );
        const subsGained = snapshots.reduce(
          (sum, s) => sum + s.subscribersGained,
          0
        );
        const subsLost = snapshots.reduce(
          (sum, s) => sum + s.subscribersLost,
          0
        );

        return {
          clientId: client.id,
          clientName: client.name,
          companyName: client.companyName,
          isConnected: true,
          channelTitle: channel.channelTitle,
          channelAvatar: channel.channelAvatar,
          currentSubscribers: channel.subscriberCount,
          subscriberChange: subsGained - subsLost,
          viewsInPeriod,
          watchTimeHours: Math.round(watchTimeHours * 10) / 10,
          estimatedRevenue:
            revenue > 0 ? Math.round(revenue * 100) / 100 : null,
          lastSyncedAt: channel.lastSyncedAt?.toISOString() || null,
          syncStatus: channel.syncStatus,
        };
      })
    );

    // Summary totals
    const connected = clientsData.filter((c) => c.isConnected);
    const summary = {
      totalClients: clients.length,
      connectedClients: connected.length,
      totalSubscribers: connected.reduce(
        (sum, c) => sum + c.currentSubscribers,
        0
      ),
      totalViews: connected.reduce((sum, c) => sum + c.viewsInPeriod, 0),
      totalWatchTimeHours: connected.reduce(
        (sum, c) => sum + c.watchTimeHours,
        0
      ),
      totalRevenue: connected.reduce(
        (sum, c) => sum + (c.estimatedRevenue || 0),
        0
      ),
    };

    return NextResponse.json({ summary, clients: clientsData });
  } catch (error: any) {
    console.error("[YouTube Admin Analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin analytics" },
      { status: 500 }
    );
  }
}