import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const userId = Number(decoded.userId);

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== userId) {
            return NextResponse.json({ message: "Not found" }, { status: 404 });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { read: true },
        });

        return NextResponse.json({ notification: updated });
    } catch (err) {
        console.error("PATCH /api/notifications/:id/read error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
