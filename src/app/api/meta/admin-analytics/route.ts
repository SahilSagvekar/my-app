export const dynamic = 'force-dynamic';
// src/app/api/meta/admin-analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { metaAccount, metaSnapshot } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const accounts = await db.query.metaAccount.findMany({
            with: {
                client: {
                    columns: { name: true }
                },
                metaSnapshots: {
                    where: eq(metaSnapshot.dateRange, '28d'),
                    orderBy: desc(metaSnapshot.snapshotDate),
                    limit: 1
                }
            }
        });

        const data = accounts.map((acc: any) => {
            const snap = acc.metaSnapshots[0];
            const engagementRate = acc.followerCount > 0
                ? ((snap?.engagement || 0) / acc.followerCount) * 100
                : 0;

            return {
                id: acc.id,
                clientId: acc.clientId,
                clientName: acc.client.name,
                username: acc.username,
                followers: acc.followerCount,
                impressions: Number(snap?.impressions || 0),
                reach: Number(snap?.reach || 0),
                engagementRate: Math.round(engagementRate * 100) / 100,
                lastSynced: acc.lastSyncedAt,
                syncStatus: acc.syncStatus
            };
        });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Meta admin analytics API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
