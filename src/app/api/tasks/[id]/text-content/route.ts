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

// PATCH /api/tasks/[id]/text-content — save the Text Post copy body
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        if (!token)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        jwt.verify(token, process.env.JWT_SECRET!);

        const { textContent } = await req.json();
        if (typeof textContent !== "string") {
            return NextResponse.json({ message: "textContent must be a string" }, { status: 400 });
        }

        const task = await prisma.task.findUnique({ where: { id } });
        if (!task)
            return NextResponse.json({ message: "Task not found" }, { status: 404 });

        await prisma.task.update({
            where: { id },
            data: { textContent },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Text content update error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}
