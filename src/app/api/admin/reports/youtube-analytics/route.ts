export const dynamic = 'force-dynamic';
// app/api/admin/reports/youtube-analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { youTubeSnapshot } from '@/lib/db/schema';
import { and, eq, gte, lt, asc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
    try {
        const user = await getCurrentUser2(req);
        if (!user || user.role?.toLowerCase() !== 'admin') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "30d";
        const clientId = searchParams.get("clientId");

        // Calculate date range
        const days = parseInt(range.replace("d", ""));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - days);

        // 1. Fetch all connected channels for the filter
        const allChannels = await db.query.youTubeChannel.findMany({
            with: { client: { columns: { companyName: true, name: true } } }
        });

        // 2. Build filter for snapshots
        const baseConditions = [eq(youTubeSnapshot.periodType, "DAILY")];
        if (clientId && clientId !== 'all') {
            baseConditions.push(eq(youTubeSnapshot.clientId, clientId));
        }

        // 3. Fetch snapshots for the current period
        const snapshots = await db.select().from(youTubeSnapshot)
            .where(and(...baseConditions, gte(youTubeSnapshot.periodStart, startDate.toISOString())))
            .orderBy(asc(youTubeSnapshot.periodStart));

        // 4. Fetch snapshots for the previous period to calculate trends
        const prevSnapshots = await db.select().from(youTubeSnapshot)
            .where(and(
                ...baseConditions,
                gte(youTubeSnapshot.periodStart, prevStartDate.toISOString()),
                lt(youTubeSnapshot.periodStart, startDate.toISOString())
            ));

        // 5. Aggregate KPI Metrics
        const totalViews = snapshots.reduce((sum, s) => sum + Number(s.views), 0);
        const prevTotalViews = prevSnapshots.reduce((sum, s) => sum + Number(s.views), 0);

        const totalLikes = snapshots.reduce((sum, s) => sum + s.likes, 0);
        const totalComments = snapshots.reduce((sum, s) => sum + s.comments, 0);
        const totalEngagement = totalLikes + totalComments;

        const prevTotalLikes = prevSnapshots.reduce((sum, s) => sum + s.likes, 0);
        const prevTotalComments = prevSnapshots.reduce((sum, s) => sum + s.comments, 0);
        const prevTotalEngagement = prevTotalLikes + prevTotalComments;

        // 6. Format monthly/daily trend data for chart
        const dailyDataMap = new Map();
        snapshots.forEach(s => {
            const date = new Date(s.periodStart).toISOString().split('T')[0];
            const existing = dailyDataMap.get(date) || { views: 0, engagement: 0 };
            dailyDataMap.set(date, {
                views: existing.views + Number(s.views),
                engagement: existing.engagement + s.likes + s.comments
            });
        });

        const dailyData = Array.from(dailyDataMap.entries()).map(([date, data]) => ({
            date,
            ...data
        })).sort((a, b) => a.date.localeCompare(b.date));

        // 7. Per-Client Performance
        const clientPerformanceMap = new Map();

        // Initialize with all channels
        allChannels.forEach(ch => {
            clientPerformanceMap.set(ch.clientId, {
                id: ch.clientId,
                name: ch.client.companyName || ch.client.name,
                views: 0,
                engagement: 0,
                subs: ch.subscriberCount
            });
        });

        snapshots.forEach(s => {
            const perf = clientPerformanceMap.get(s.clientId);
            if (perf) {
                perf.views += Number(s.views);
                perf.engagement += (s.likes + s.comments);
            }
        });

        const clientPerformance = Array.from(clientPerformanceMap.values())
            .sort((a, b) => b.views - a.views);

        return NextResponse.json({
            ok: true,
            summary: {
                totalViews,
                viewsChange: calculateChange(totalViews, prevTotalViews),
                totalEngagement,
                engagementChange: calculateChange(totalEngagement, prevTotalEngagement),
                connectedChannels: allChannels.length,
            },
            dailyData,
            clientPerformance,
            clients: allChannels.map(ch => ({
                id: ch.clientId,
                name: ch.client.companyName || ch.client.name
            }))
        });

    } catch (error) {
        console.error("[ADMIN YT ANALYTICS] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function calculateChange(current: number, previous: number) {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}
