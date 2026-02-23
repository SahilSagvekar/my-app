import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: any) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userId = user.id;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return NextResponse.json({ notifications });
    } catch (err) {
        console.error("GET /api/notifications error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
