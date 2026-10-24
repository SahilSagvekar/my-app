export const dynamic = 'force-dynamic';

// POST /api/tasks/[id]/files/[fileId]/remove-rejected
//
// Lets the EDITOR assigned to a hard post remove an image that QC or the
// client rejected, instead of replacing it — for batches where one picture
// should simply be dropped from the set. Deliberately narrow so editors can't
// delete anything else: the caller must be the task's editor (or admin), the
// image must be an active image on this task with an open rejection, and the
// set must keep at least one other image. The file is marked inactive (kept in
// storage and the database), not deleted.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { file as fileTable, task as taskTable } from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";
import { getOpenImageRejections } from "@/lib/rejected-images";
import { taskFeedback } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: taskId, fileId } = await params;
    const db = getDbHttp();

    const [taskRow] = await db
      .select({ id: taskTable.id, assignedTo: taskTable.assignedTo })
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .limit(1);
    if (!taskRow) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const role = (user.role || "").toLowerCase();
    const isAssignedEditor = role === "editor" && Number(taskRow.assignedTo) === Number(user.id);
    if (!isAssignedEditor && role !== "admin") {
      return NextResponse.json({ error: "Only the editor on this task can remove a rejected image" }, { status: 403 });
    }

    const [img] = await db
      .select()
      .from(fileTable)
      .where(
        and(
          eq(fileTable.id, fileId),
          eq(fileTable.taskId, taskId),
          eq(fileTable.isActive, true),
          like(fileTable.mimeType, "image/%"),
        ),
      )
      .limit(1);
    if (!img) return NextResponse.json({ error: "Image not found" }, { status: 404 });

    const rejections = (await getOpenImageRejections(db, taskId)).filter(r => r.fileId === fileId);
    if (rejections.length === 0) {
      return NextResponse.json({ error: "Only images rejected by QC or the client can be removed" }, { status: 400 });
    }

    const activeImages = await db
      .select({ id: fileTable.id })
      .from(fileTable)
      .where(
        and(
          eq(fileTable.taskId, taskId),
          eq(fileTable.isActive, true),
          like(fileTable.mimeType, "image/%"),
          img.folderType ? eq(fileTable.folderType, img.folderType) : eq(fileTable.taskId, taskId),
        ),
      );
    if (activeImages.length <= 1) {
      return NextResponse.json(
        { error: "This is the only image in the set — replace it instead of removing it" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    await db.update(fileTable).set({ isActive: false, replacedAt: now }).where(eq(fileTable.id, fileId));
    await db
      .update(taskFeedback)
      .set({ status: "resolved", resolvedAt: now })
      .where(inArray(taskFeedback.id, rejections.map(r => r.feedbackId)));

    return NextResponse.json({ success: true, removedFileId: fileId });
  } catch (error: any) {
    console.error("Error removing rejected image:", error);
    return NextResponse.json({ error: "Failed to remove image", message: error?.message }, { status: 500 });
  }
}
