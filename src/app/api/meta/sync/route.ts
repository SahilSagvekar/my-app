export const dynamic = 'force-dynamic';
// src/app/api/meta/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2, resolveClientIdForUser } from "@/lib/auth";
import { MetaService } from "@/lib/meta";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        let clientId = searchParams.get("clientId");

        if (user.role === 'client') {
            // 🔥 FIX: Use resolveClientIdForUser for multi-user client support
            const resolvedClientId = await resolveClientIdForUser(user.id);
            clientId = resolvedClientId;
        }

        if (!clientId) {
            return NextResponse.json({ error: "clientId is required" }, { status: 400 });
        }

        const result = await MetaService.syncAccount(clientId);

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Meta Sync API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
