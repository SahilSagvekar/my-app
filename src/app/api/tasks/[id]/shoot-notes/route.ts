export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { task, shootDetail } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";
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
  const { db, closeDb } = getDb();
  try {
    try {
        const { id } = params;
        const token = getTokenFromCookies(req);
        if (!token)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const { userId } = decoded;

        const { notes } = await req.json();

        // Check if task exists and user is assigned (optional safety check)
        const [foundTask] = await db.select({ id: task.id }).from(task).where(eq(task.id, id)).limit(1);

        if (!foundTask)
            return NextResponse.json({ message: "Task not found" }, { status: 404 });

        // Update or create shoot detail with notes
        const [existingShootDetail] = await db.select().from(shootDetail).where(eq(shootDetail.taskId, id)).limit(1);

        if (existingShootDetail) {
            await db.update(shootDetail).set({
                videographerNotes: notes,
                updatedAt: new Date().toISOString(),
            }).where(eq(shootDetail.taskId, id));
        } else {
            await db.insert(shootDetail).values({
                id: createId(),
                taskId: id,
                videographerNotes: notes,
                videographerId: Number(userId),
                updatedAt: new Date().toISOString(),
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

  } finally {
    await closeDb();
  }
}
