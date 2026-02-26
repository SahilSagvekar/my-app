export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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

        const where: any = {};

        // If a specific category is requested
        if (category) {
            where.category = category;
        }

        // Role filtering: 
        // - Admin sees everything.
        // - Teams see general rules + rules targeted at their role + rules for their assigned clients.
        if (user.role !== 'admin' && user.role !== 'manager') {
            where.OR = [
                { role: null }, // General rules for everyone
                { role: user.role } // Rules for their specific role
            ];

            // If we are looking for client specific rules, we might need more logic, 
            // but for now let's allow filtering by role.
        } else {
            // Admins can filter by role via query param if they want
            if (role && role !== 'all') {
                where.role = role;
            }
        }

        if (clientId && clientId !== 'all') {
            where.clientId = clientId;
        }

        const guidelines = await prisma.guideline.findMany({
            where,
            include: {
                client: {
                    select: {
                        name: true,
                        companyName: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ ok: true, guidelines });
    } catch (error: any) {
        console.error("GET /api/guidelines error:", error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
