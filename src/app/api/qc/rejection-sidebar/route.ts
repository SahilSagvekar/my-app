import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { task as taskTable } from "@/lib/db/schema";
import { and, eq, ne, isNotNull, gte } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

const TaskStatus = {
  REJECTED: "REJECTED",
} as const;

export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    // Look back over the last 90 days for signal
    const since = new Date();
    since.setMonth(since.getMonth() - 3);

    // 1) QC rejections: same editor + same qcNotes reason rejected >= 3 times
    const rawQcRejectedTasks = await db.query.task.findMany({
      where: and(
        eq(taskTable.status, TaskStatus.REJECTED),
        isNotNull(taskTable.qcNotes),
        gte(taskTable.updatedAt, since.toISOString())
      ),
      columns: { id: true, title: true, qcNotes: true, assignedTo: true },
      with: {
        // taskRelations names the assignedTo-FK relation "user_assignedTo"
        user_assignedTo: { columns: { name: true } },
      },
    });
    // Renamed to `user` below to match the original Prisma include shape.
    const qcRejectedTasks = rawQcRejectedTasks.map(({ user_assignedTo, ...t }) => ({
      ...t,
      user: user_assignedTo,
    }));

    const qcMap = new Map<
      string,
      { count: number; sample: { taskId: string; title: string; editorName: string | null; reason: string } }
    >();

    for (const t of qcRejectedTasks) {
      if (!t.qcNotes) continue;
      const key = `${t.assignedTo}:${t.qcNotes.trim()}`;
      const existing = qcMap.get(key);
      const baseSample = {
        taskId: t.id,
        title: t.title || "Untitled task",
        editorName: t.user?.name || null,
        reason: t.qcNotes.trim(),
      };
      if (!existing) {
        qcMap.set(key, { count: 1, sample: baseSample });
      } else {
        existing.count += 1;
        // keep the most recent sample by default (tasks are not ordered here, but recency isn't critical)
        qcMap.set(key, existing);
      }
    }

    const qcRejections = Array.from(qcMap.values())
      .filter((entry) => entry.count >= 3)
      .map((entry) => ({
        ...entry.sample,
        count: entry.count,
      }));

    // 2) Client rejections: same client + same feedback reason rejected >= 3 times
    const clientRejectedTasks = await db.query.task.findMany({
      where: and(
        eq(taskTable.status, TaskStatus.REJECTED),
        eq(taskTable.clientReview, true),
        isNotNull(taskTable.feedback),
        gte(taskTable.updatedAt, since.toISOString())
      ),
      columns: { id: true, title: true, feedback: true, clientId: true },
      with: {
        client: { columns: { name: true, companyName: true } },
      },
    });

    const clientMap = new Map<
      string,
      { count: number; sample: { taskId: string; title: string; clientName: string | null; reason: string } }
    >();

    for (const t of clientRejectedTasks) {
      if (!t.feedback || !t.clientId) continue;
      const key = `${t.clientId}:${t.feedback.trim()}`;
      const existing = clientMap.get(key);
      const baseSample = {
        taskId: t.id,
        title: t.title || "Untitled task",
        clientName: t.client?.companyName || t.client?.name || null,
        reason: t.feedback.trim(),
      };
      if (!existing) {
        clientMap.set(key, { count: 1, sample: baseSample });
      } else {
        existing.count += 1;
        clientMap.set(key, existing);
      }
    }

    const clientRejections = Array.from(clientMap.values())
      .filter((entry) => entry.count >= 3)
      .map((entry) => ({
        ...entry.sample,
        count: entry.count,
      }));

    return NextResponse.json({
      ok: true,
      qcRejections,
      clientRejections,
    });
  } catch (err) {
    console.error("GET /api/qc/rejection-sidebar error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to load rejection sidebar data" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}
