export const dynamic = 'force-dynamic';

// POST /api/tasks/[id]/files/[fileId]/crop
//
// Hard post / picture review: lets QC (and the client) crop or change the
// aspect ratio of one image instead of sending it back to the editor. The
// browser does the crop on a canvas and posts the result as multipart form
// data (field "file"). This route stores it as a NEW VERSION of that same
// image slot: the old file is kept (isActive=false, replacedBy → new file) so
// the original is never lost and the version history still works.
//
// Deliberately does NOT go through /api/upload/complete: that route queues an
// upload job (editor-upload notifications, workflow status changes, NAS/Drive
// mirroring) which a reviewer's crop must not trigger. The new row keeps the
// original file's uploadedBy so editor upload stats are unaffected; who cropped
// it is recorded in revisionNote.
//
// Workers-compatible: arrayBuffer() only, no filesystem access (same pattern as
// /api/tasks/[id]/feedback/attachments).

import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { createId } from "@/lib/db/id";
import {
  file as fileTable,
  task as taskTable,
  client as clientTable,
} from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";
import { uploadBufferToS3, addSignedUrlsToFiles } from "@/lib/s3";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — plenty for a cropped still
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// Roles that may crop any task's images.
const STAFF_ROLES = new Set(["admin", "manager", "qc"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId, fileId } = await params;
    if (!taskId || !fileId) {
      return NextResponse.json({ error: "Missing task or file id" }, { status: 400 });
    }

    const db = getDbHttp();

    const [taskRow] = await db
      .select({
        id: taskTable.id,
        clientId: taskTable.clientId,
        attachments: taskTable.attachments,
      })
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .limit(1);
    if (!taskRow) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // ── Permission: QC/admin/manager, or the client this task belongs to ──
    const role = (user.role || "").toLowerCase();
    let allowed = STAFF_ROLES.has(role);
    if (!allowed && role === "client" && taskRow.clientId) {
      if (user.linkedClientId && user.linkedClientId === taskRow.clientId) {
        allowed = true;
      } else {
        const [ownClient] = await db
          .select({ id: clientTable.id })
          .from(clientTable)
          .where(and(eq(clientTable.id, taskRow.clientId), eq(clientTable.userId, user.id)))
          .limit(1);
        allowed = !!ownClient;
      }
    }
    if (!allowed) {
      return NextResponse.json({ error: "You can't edit images on this task" }, { status: 403 });
    }

    // ── The image being replaced: must be this task's current active image ──
    const [oldFile] = await db
      .select()
      .from(fileTable)
      .where(
        and(
          eq(fileTable.id, fileId),
          eq(fileTable.taskId, taskId),
          eq(fileTable.isActive, true),
        ),
      )
      .limit(1);
    if (!oldFile) {
      return NextResponse.json(
        { error: "Image not found, or it has already been replaced by a newer version" },
        { status: 404 },
      );
    }
    if (!(oldFile.mimeType || "").startsWith("image/")) {
      return NextResponse.json({ error: "Only images can be cropped" }, { status: 400 });
    }

    // ── The cropped image from the browser ──
    const form = await req.formData();
    const blob = form.get("file") as File | null;
    if (!blob) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (blob.size === 0) {
      return NextResponse.json({ error: "Empty image" }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image exceeds ${MAX_BYTES / (1024 * 1024)}MB limit` },
        { status: 413 },
      );
    }
    const mimeType = (blob.type || "").toLowerCase();
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    // ── Store next to the original: same folder, name keeps the base + new version ──
    const newVersion = (oldFile.version || 1) + 1;
    const origKey = oldFile.s3Key || "";
    const folderPrefix = origKey.includes("/")
      ? origKey.slice(0, origKey.lastIndexOf("/") + 1)
      : `crops/${taskId}/`;
    const origName = oldFile.name || "image";
    const baseName = origName
      .replace(/\.[^.]+$/, "")
      .replace(/-v\d+$/i, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 120);
    const newName = `${baseName}-v${newVersion}.${ext}`;
    const storedName = `${baseName.replace(/ /g, "_")}-v${newVersion}-${Date.now().toString(36)}.${ext}`;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const upload = await uploadBufferToS3({
      buffer,
      folderPrefix,
      filename: storedName,
      mimeType,
    });

    const now = new Date().toISOString();
    const newId = createId();
    const croppedBy = user.name || user.email || `user ${user.id}`;

    const [inserted] = await db
      .insert(fileTable)
      .values({
        id: newId,
        taskId,
        name: newName,
        url: upload.url,
        s3Key: upload.key,
        mimeType,
        size: blob.size,
        // Keep the original uploader so editor stats/attribution are unchanged.
        uploadedBy: oldFile.uploadedBy,
        folderType: oldFile.folderType,
        version: newVersion,
        isActive: true,
        revisionNote: `Cropped by ${croppedBy} (${role || "user"})`,
        uploadedAt: now,
        createdAt: now,
        storageBackend: oldFile.storageBackend || "r2",
      })
      .returning();

    await db
      .update(fileTable)
      .set({ isActive: false, replacedAt: now, replacedBy: newId })
      .where(eq(fileTable.id, oldFile.id));

    // The task stores a manual image order as file IDs — swap the old ID for
    // the new one, otherwise the cropped image would drop to the end of the set.
    const attachments =
      taskRow.attachments && typeof taskRow.attachments === "object"
        ? (taskRow.attachments as Record<string, any>)
        : null;
    if (attachments && Array.isArray(attachments.imageOrder) && attachments.imageOrder.includes(oldFile.id)) {
      await db
        .update(taskTable)
        .set({
          attachments: {
            ...attachments,
            imageOrder: attachments.imageOrder.map((id: string) => (id === oldFile.id ? newId : id)),
          },
          updatedAt: now,
        })
        .where(eq(taskTable.id, taskId));
    } else {
      await db
        .update(taskTable)
        .set({
          driveLinks: sql`array_append(${taskTable.driveLinks}, ${upload.url})`,
          updatedAt: now,
        })
        .where(eq(taskTable.id, taskId));
    }

    const [signed] = await addSignedUrlsToFiles([inserted]);
    return NextResponse.json({
      success: true,
      file: signed,
      replacedFileId: oldFile.id,
      version: newVersion,
    });
  } catch (error: any) {
    console.error("Error cropping image:", error);
    return NextResponse.json(
      { error: "Failed to save cropped image", message: error?.message },
      { status: 500 },
    );
  }
}
