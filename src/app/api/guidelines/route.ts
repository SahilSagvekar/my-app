export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guideline } from "@/lib/db/schema";
import { and, eq, or, isNull, desc } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const role = searchParams.get("role"); // Filter by role (qc, editor)
        const clientId = searchParams.get("clientId");

        const conditions = [];

        // If a specific category is requested
        if (category) {
            conditions.push(eq(guideline.category, category));
        }

        // Role filtering:
        // - Admin sees everything.
        // - Teams see general rules + rules targeted at their role + rules for their assigned clients.
        if (user.role !== 'admin' && user.role !== 'manager') {
            conditions.push(or(
                isNull(guideline.role), // General rules for everyone
                eq(guideline.role, user.role as any) // Rules for their specific role
            ));

            // If we are looking for client specific rules, we might need more logic,
            // but for now let's allow filtering by role.
        } else {
            // Admins can filter by role via query param if they want
            if (role && role !== 'all') {
                conditions.push(eq(guideline.role, role as any));
            }
        }

        if (clientId && clientId !== 'all') {
            conditions.push(eq(guideline.clientId, clientId));
        }

        const guidelines = await db.query.guideline.findMany({
            where: conditions.length ? and(...conditions) : undefined,
            with: {
                client: {
                    columns: {
                        name: true,
                        companyName: true,
                    }
                }
            },
            orderBy: desc(guideline.createdAt)
        });

        return NextResponse.json({ ok: true, guidelines });
    } catch (error: any) {
        console.error("GET /api/guidelines error:", error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
