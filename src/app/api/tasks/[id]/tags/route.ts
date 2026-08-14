export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { task, tag, tagToTask } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// PATCH /api/tasks/[id]/tags — set a task's tags by name.
// Creates any tag names that don't exist yet, then connects the full set
// (replaces the previous tag list rather than appending). Adding tags stays
// open to anyone; removing a tag that's currently on the task is admin-only.
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const { id } = await params;
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const role = (decoded?.role || "").toLowerCase();

        const { tagNames } = await req.json();
        if (!Array.isArray(tagNames)) {
            return NextResponse.json({ message: "tagNames must be an array of strings" }, { status: 400 });
        }

        const names = [...new Set(tagNames.map((n: string) => n.trim()).filter(Boolean))];

        const foundTask = await db.query.task.findFirst({
            where: eq(task.id, id),
            columns: { id: true },
            with: { tagToTasks: { with: { tag: true } } },
        });
        if (!foundTask) return NextResponse.json({ message: "Task not found" }, { status: 404 });

        const currentTags = (foundTask as any).tagToTasks.map((tt: any) => tt.tag);

        // Anything currently on the task that isn't in the incoming list is a
        // removal — only admins can do that. Additions (new names not currently
        // on the task) are unaffected and stay open to everyone.
        const requestedLower = new Set(names.map((n) => n.toLowerCase()));
        const isRemoval = currentTags.some((t: any) => !requestedLower.has(t.name.toLowerCase()));
        if (isRemoval && role !== "admin") {
            return NextResponse.json(
                { message: "Only admins can remove tags from a task" },
                { status: 403 }
            );
        }

        const tags = await Promise.all(
            names.map(async (name) => {
                const [existing] = await db.select().from(tag)
                    .where(sql`lower(${tag.name}) = lower(${name})`).limit(1);
                if (existing) return existing;
                const [created] = await db.insert(tag).values({ id: createId(), name }).returning();
                return created;
            })
        );

        // Replace the full tag set for this task (mirrors Prisma's tags: { set: [...] },
        // which is atomic — wrap in a transaction so we never leave the task tagless mid-swap)
        await db.transaction(async (tx) => {
            await tx.delete(tagToTask).where(eq(tagToTask.b, id));
            if (tags.length > 0) {
                await tx.insert(tagToTask).values(tags.map((t) => ({ a: t.id, b: id })));
            }
        });

        return NextResponse.json({ success: true, tags });
    } catch (err: any) {
        console.error("Task tags update error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}