export const dynamic = 'force-dynamic';
// src/app/api/youtube/admin-analytics/route.ts
// Admin-only: returns YouTube data for ALL clients

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { client as clientTable, youTubeChannel, youTubeSnapshot } from "@/lib/db/schema";
import { and, asc, eq, gte } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = getDbHttp();
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
    // NOTE: YouTubeChannel has a unique index on clientId (1:1 with Client),
    // even though relations.ts labels it `many()` — see schema.ts.
    const clientRows = await db.select({
      clientId: clientTable.id,
      clientName: clientTable.name,
      companyName: clientTable.companyName,
      channelPk: youTubeChannel.id,
      channelTitle: youTubeChannel.channelTitle,
      channelAvatar: youTubeChannel.channelAvatar,
      subscriberCount: youTubeChannel.subscriberCount,
      lastSyncedAt: youTubeChannel.lastSyncedAt,
      syncStatus: youTubeChannel.syncStatus,
    })
      .from(clientTable)
      .leftJoin(youTubeChannel, eq(youTubeChannel.clientId, clientTable.id))
      .where(eq(clientTable.status, "active"))
      .orderBy(asc(clientTable.name));

    const clientsData = await Promise.all(
      clientRows.map(async (row) => {
        if (!row.channelPk) {
          return {
            clientId: row.clientId,
            clientName: row.clientName,
            companyName: row.companyName,
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
        const snapshots = await db.select().from(youTubeSnapshot)
          .where(and(
            eq(youTubeSnapshot.channelId, row.channelPk),
            gte(youTubeSnapshot.snapshotDate, startDate.toISOString()), // Changed from periodStart to snapshotDate
            eq(youTubeSnapshot.periodType, "DAILY"),
          ));

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
          clientId: row.clientId,
          clientName: row.clientName,
          companyName: row.companyName,
          isConnected: true,
          channelTitle: row.channelTitle,
          channelAvatar: row.channelAvatar,
          currentSubscribers: row.subscriberCount,
          subscriberChange: subsGained - subsLost,
          viewsInPeriod,
          watchTimeHours: Math.round(watchTimeHours * 10) / 10,
          estimatedRevenue:
            revenue > 0 ? Math.round(revenue * 100) / 100 : null,
          lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null,
          syncStatus: row.syncStatus,
        };
      })
    );

    // Summary totals
    const connected = clientsData.filter((c) => c.isConnected);
    const summary = {
      totalClients: clientRows.length,
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