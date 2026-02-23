import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

import { getCurrentUser2 } from "@/lib/auth";

export async function PATCH(req: any) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userId = user.id;

        await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("PATCH /api/notifications/mark-all-read error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
