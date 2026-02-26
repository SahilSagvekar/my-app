export const dynamic = 'force-dynamic';
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
        const { id } = params;
        const token = getTokenFromCookies(req);
        if (!token)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const { userId } = decoded;

        const { notes } = await req.json();

        // Check if task exists and user is assigned (optional safety check)
        const task = await (prisma.task as any).findUnique({
            where: { id },
            include: { shootDetail: true }
        });

        if (!task)
            return NextResponse.json({ message: "Task not found" }, { status: 404 });

        // Update or create shoot detail with notes
        if (task.shootDetail) {
            await (prisma as any).shootDetail.update({
                where: { taskId: id },
                data: { videographerNotes: notes }
            });
        } else {
            await (prisma as any).shootDetail.create({
                data: {
                    taskId: id,
                    videographerNotes: notes,
                    videographerId: Number(userId)
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Shoot notes update error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}
