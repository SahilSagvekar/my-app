export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { task } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  const { db, closeDb } = getDb();
  try {
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

        const [foundTask] = await db.select({ id: task.id }).from(task).where(eq(task.id, id)).limit(1);
        if (!foundTask)
            return NextResponse.json({ message: "Task not found" }, { status: 404 });

        await db.update(task).set({ textContent, updatedAt: new Date().toISOString() }).where(eq(task.id, id));

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Text content update error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
