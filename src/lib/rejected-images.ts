// Hard post / picture review: "reject this image" is stored as a TaskFeedback
// row with category `image_rejected` on that file. A rejected image is dropped
// from the set — never shown to the client or the scheduler — by marking the
// file inactive when the set is approved (QC → client, client → scheduler) or
// when the editor removes it. Nothing is hard-deleted.
import { and, eq, inArray, isNotNull, like, ne } from "drizzle-orm";
import { taskFeedback, file as fileTable } from "@/lib/db/schema";

export const IMAGE_REJECTED_CATEGORY = "image_rejected";

type Db = any; // drizzle http/pool client — only select/update are used

/** Open rejections on this task's CURRENT (active) images. */
export async function getOpenImageRejections(db: Db, taskId: string) {
  const rows = await db
    .select({
      feedbackId: taskFeedback.id,
      fileId: taskFeedback.fileId,
      folderType: fileTable.folderType,
    })
    .from(taskFeedback)
    .innerJoin(fileTable, eq(fileTable.id, taskFeedback.fileId))
    .where(
      and(
        eq(taskFeedback.taskId, taskId),
        like(taskFeedback.category, `%${IMAGE_REJECTED_CATEGORY}%`),
        ne(taskFeedback.status, "resolved"),
        isNotNull(taskFeedback.fileId),
        eq(fileTable.isActive, true),
        like(fileTable.mimeType, "image/%"),
      ),
    );
  return rows as { feedbackId: string; fileId: string; folderType: string | null }[];
}

/**
 * Refuses approval when every image in a folder is rejected (that would leave
 * an empty set). Returns an error message, or null when it's fine.
 */
export async function checkRejectionsLeaveImages(db: Db, taskId: string): Promise<string | null> {
  const rejected = await getOpenImageRejections(db, taskId);
  if (rejected.length === 0) return null;
  const folders = [...new Set(rejected.map(r => r.folderType))];
  for (const folder of folders) {
    const active = await db
      .select({ id: fileTable.id })
      .from(fileTable)
      .where(
        and(
          eq(fileTable.taskId, taskId),
          eq(fileTable.isActive, true),
          like(fileTable.mimeType, "image/%"),
          folder ? eq(fileTable.folderType, folder) : isNotNull(fileTable.id),
        ),
      );
    const rejectedHere = rejected.filter(r => r.folderType === folder).length;
    if (active.length > 0 && rejectedHere >= active.length) {
      return "Every image in this set is rejected. Send it back to the editor, or un-reject at least one image before approving.";
    }
  }
  return null;
}

/** Marks every rejected active image inactive and closes its rejection. Returns how many were dropped. */
export async function dropRejectedImages(db: Db, taskId: string): Promise<number> {
  const rejected = await getOpenImageRejections(db, taskId);
  if (rejected.length === 0) return 0;
  const now = new Date().toISOString();
  const fileIds = [...new Set(rejected.map(r => r.fileId))];
  await db
    .update(fileTable)
    .set({ isActive: false, replacedAt: now })
    .where(and(eq(fileTable.taskId, taskId), inArray(fileTable.id, fileIds)));
  await db
    .update(taskFeedback)
    .set({ status: "resolved", resolvedAt: now })
    .where(inArray(taskFeedback.id, rejected.map(r => r.feedbackId)));
  return fileIds.length;
}
