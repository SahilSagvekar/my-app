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

// PATCH /api/tasks/[id]/tags — set a task's tags by name.
// Creates any tag names that don't exist yet, then connects the full set
// (replaces the previous tag list rather than appending).
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        jwt.verify(token, process.env.JWT_SECRET!);

        const { tagNames } = await req.json();
        if (!Array.isArray(tagNames)) {
            return NextResponse.json({ message: "tagNames must be an array of strings" }, { status: 400 });
        }

        const names = [...new Set(tagNames.map((n: string) => n.trim()).filter(Boolean))];

        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) return NextResponse.json({ message: "Task not found" }, { status: 404 });

        const tags = await Promise.all(
            names.map(async (name) => {
                const existing = await prisma.tag.findFirst({
                    where: { name: { equals: name, mode: "insensitive" } },
                });
                return existing || prisma.tag.create({ data: { name } });
            })
        );

        const updated = await prisma.task.update({
            where: { id },
            data: { tags: { set: tags.map((t) => ({ id: t.id })) } },
            include: { tags: true },
        });

        return NextResponse.json({ success: true, tags: updated.tags });
    } catch (err: any) {
        console.error("Task tags update error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}
