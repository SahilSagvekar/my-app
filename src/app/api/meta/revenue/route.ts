export const dynamic = 'force-dynamic';
// src/app/api/meta/revenue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clientRevenue } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@/lib/db/id";
import { getCurrentUser2, resolveClientIdForUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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

        const now = new Date().toISOString();
        const [revenue] = await db.insert(clientRevenue).values({
            id: createId(),
            clientId,
            platform,
            amount: String(amount),
            source,
            notes,
            period: normalizedPeriod.toISOString(),
            isAutomatic: false,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: [clientRevenue.clientId, clientRevenue.platform, clientRevenue.period, clientRevenue.source],
            set: {
                amount: String(amount),
                notes,
                isAutomatic: false,
                updatedAt: now,
            }
        }).returning();

        return NextResponse.json({ success: true, data: revenue });
    } catch (error: any) {
        console.error("Revenue API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}

export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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

        const revenues = await db.select().from(clientRevenue)
            .where(eq(clientRevenue.clientId, clientId))
            .orderBy(desc(clientRevenue.period));

        return NextResponse.json(revenues);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
