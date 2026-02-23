// src/app/api/meta/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2, resolveClientIdForUser } from "@/lib/auth";
import { MetaAnalyticsData } from "@/types/meta";

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        let clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "28d";

        if (user.role === 'client') {
            // 🔥 FIX: Use resolveClientIdForUser for multi-user client support
            const resolvedClientId = await resolveClientIdForUser(user.id);
            clientId = resolvedClientId;
        }

        if (!clientId) {
            return NextResponse.json({ error: "clientId is required" }, { status: 400 });
        }

        const account = await prisma.metaAccount.findUnique({
            where: { clientId },
            include: {
                snapshots: {
                    where: { dateRange: range },
                    orderBy: { snapshotDate: 'desc' },
                    take: 1
                }
            }
        });

        if (!account) {
            return NextResponse.json({ connected: false });
        }

        const snapshot = account.snapshots[0];

        // Get latest manual revenue entry for Instagram
        const revenueEntries = await prisma.clientRevenue.findMany({
            where: {
                clientId,
                platform: 'instagram'
            },
            orderBy: { period: 'desc' },
            take: 1
        });

        // Calculate engagement rate based on 28d snapshot
        const engagementRate = account.followerCount > 0
            ? ((snapshot?.engagement || 0) / account.followerCount) * 100
            : 0;

        const response: MetaAnalyticsData = {
            connected: true,
            instagramId: account.instagramId!,
            username: account.username!,
            profilePicture: account.profilePicture!,
            followerCount: account.followerCount,
            followersGained: snapshot?.followersGained || 0,
            impressions: Number(snapshot?.impressions || 0),
            reach: Number(snapshot?.reach || 0),
            engagementRate: Math.round(engagementRate * 100) / 100,
            profileViews: snapshot?.profileViews || 0,
            websiteClicks: snapshot?.websiteClicks || 0,
            lastSyncedAt: account.lastSyncedAt?.toISOString() || null,
            syncStatus: account.syncStatus,
            topPosts: (snapshot?.topPosts as any) || [],
            demographics: (snapshot?.demographics as any) || null,
            revenue: revenueEntries[0] ? {
                total: Number(revenueEntries[0].amount),
                period: revenueEntries[0].period.toISOString().substring(0, 7)
            } : undefined
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error("Meta analytics API error:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
