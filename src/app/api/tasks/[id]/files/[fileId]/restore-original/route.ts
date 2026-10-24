export const dynamic = 'force-dynamic';

// POST /api/tasks/[id]/files/[fileId]/restore-original
//
// Hard post / picture review: puts an image back to how it was first uploaded
// after it was cropped / rotated. Walks the version chain (replacedBy links)
// back to the very first file of that image slot and stores a copy of it as a
// NEW version on top (the cropped versions stay in the history). Same
// permissions and bookkeeping as the crop route.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { createId } from "@/lib/db/id";
import {
  file as fileTable,
  task as taskTable,
  client as clientTable,
} from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";
import { uploadBufferToS3, addSignedUrlsToFiles, generateSignedUrl } from "@/lib/s3";

const STAFF_ROLES = new Set(["admin", "manager", "qc"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
      .select({ id: taskTable.id, clientId: taskTable.clientId, attachments: taskTable.attachments })
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .limit(1);
    if (!taskRow) return NextResponse.json({ error: "Task not found" }, { status: 404 });

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

    const [current] = await db
      .select()
      .from(fileTable)
      .where(and(eq(fileTable.id, fileId), eq(fileTable.taskId, taskId), eq(fileTable.isActive, true)))
      .limit(1);
    if (!current) {
      return NextResponse.json(
        { error: "Image not found, or it has already been replaced by a newer version" },
        { status: 404 },
      );
    }

    // Walk back to the first file of this slot.
    let original = current;
    for (let i = 0; i < 50; i++) {
      const [prev] = await db
        .select()
        .from(fileTable)
        .where(and(eq(fileTable.taskId, taskId), eq(fileTable.replacedBy, original.id)))
        .limit(1);
      if (!prev) break;
      original = prev;
    }
    if (original.id === current.id) {
      return NextResponse.json({ error: "This image is already the original" }, { status: 400 });
    }
    if (!original.s3Key || !(original.mimeType || "").startsWith("image/")) {
      return NextResponse.json({ error: "The original image can't be read" }, { status: 404 });
    }

    // Copy the original's bytes into a new version.
    const upstream = await fetch(await generateSignedUrl(original.s3Key, 300));
    if (!upstream.ok) {
      return NextResponse.json({ error: "Could not read the original from storage" }, { status: 502 });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const mimeType = (original.mimeType || "image/jpeg").toLowerCase();
    const ext = EXT_BY_MIME[mimeType] || "jpg";

    const newVersion = (current.version || 1) + 1;
    const curKey = current.s3Key || original.s3Key;
    const folderPrefix = curKey.includes("/") ? curKey.slice(0, curKey.lastIndexOf("/") + 1) : `crops/${taskId}/`;
    const baseName = (original.name || "image")
      .replace(/\.[^.]+$/, "")
      .replace(/-v\d+$/i, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 120);
    const newName = `${baseName}-v${newVersion}.${ext}`;
    const storedName = `${baseName.replace(/ /g, "_")}-v${newVersion}-${Date.now().toString(36)}.${ext}`;

    const upload = await uploadBufferToS3({ buffer, folderPrefix, filename: storedName, mimeType });

    const now = new Date().toISOString();
    const newId = createId();
    const by = user.name || user.email || `user ${user.id}`;

    const [inserted] = await db
      .insert(fileTable)
      .values({
        id: newId,
        taskId,
        name: newName,
        url: upload.url,
        s3Key: upload.key,
        mimeType,
        size: buffer.length,
        uploadedBy: current.uploadedBy,
        folderType: current.folderType,
        version: newVersion,
        isActive: true,
        revisionNote: `Original restored by ${by} (${role || "user"})`,
        uploadedAt: now,
        createdAt: now,
        storageBackend: current.storageBackend || "r2",
      })
      .returning();

    await db
      .update(fileTable)
      .set({ isActive: false, replacedAt: now, replacedBy: newId })
      .where(eq(fileTable.id, current.id));

    const attachments =
      taskRow.attachments && typeof taskRow.attachments === "object"
        ? (taskRow.attachments as Record<string, any>)
        : null;
    if (attachments && Array.isArray(attachments.imageOrder) && attachments.imageOrder.includes(current.id)) {
      await db
        .update(taskTable)
        .set({
          attachments: {
            ...attachments,
            imageOrder: attachments.imageOrder.map((id: string) => (id === current.id ? newId : id)),
          },
          updatedAt: now,
        })
        .where(eq(taskTable.id, taskId));
    }

    const [signed] = await addSignedUrlsToFiles([inserted]);
    return NextResponse.json({ success: true, file: signed, replacedFileId: current.id, version: newVersion });
  } catch (error: any) {
    console.error("Error restoring original image:", error);
    return NextResponse.json(
      { error: "Failed to restore original", message: error?.message },
      { status: 500 },
    );
  }
}
