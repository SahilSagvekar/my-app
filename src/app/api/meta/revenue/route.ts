export const dynamic = 'force-dynamic';
// src/app/api/meta/revenue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2, resolveClientIdForUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { clientId, platform, amount, source, notes, period } = body;

        if (!clientId || !platform || !amount) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Use the first day of the month for the period to aggregate by month
        const date = new Date(period);
        const normalizedPeriod = new Date(date.getFullYear(), date.getMonth(), 1);

        const revenue = await prisma.clientRevenue.upsert({
            where: {
                clientId_platform_period_source: {
                    clientId,
                    platform,
                    period: normalizedPeriod,
                    source
                }
            },
            update: {
                amount,
                notes,
                isAutomatic: false,
                updatedAt: new Date(),
            },
            create: {
                clientId,
                platform,
                amount,
                source,
                notes,
                period: normalizedPeriod,
                isAutomatic: false
            }
        });

        return NextResponse.json({ success: true, data: revenue });
    } catch (error: any) {
        console.error("Revenue API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        let clientId = searchParams.get("clientId");

        if (user.role === 'client') {
            // 🔥 FIX: Use resolveClientIdForUser for multi-user client support
            const resolvedClientId = await resolveClientIdForUser(user.id);
            clientId = resolvedClientId;
        }

        if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

        const revenues = await prisma.clientRevenue.findMany({
            where: { clientId },
            orderBy: { period: 'desc' }
        });

        return NextResponse.json(revenues);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
