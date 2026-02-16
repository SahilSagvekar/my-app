import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { title, content, category, role, clientId } = body;

        if (!title || !content || !category) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const guideline = await prisma.guideline.create({
            data: {
                title,
                content,
                category,
                role: role === 'all' ? null : role,
                clientId: clientId === 'all' ? null : clientId,
            }
        });

        return NextResponse.json({ ok: true, guideline });
    } catch (error: any) {
        console.error("POST /api/admin/guidelines error:", error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
