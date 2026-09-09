// src/lib/file-deletion.ts
//
// The actual "delete a file" mechanics (R2 object + DB row + audit log),
// factored out so DELETE /api/files/[id] (admin/videographer direct
// delete) and the deletion-request approval route both go through the
// exact same path instead of two copies drifting apart.
//
// Converted to Drizzle (getDbHttp) for Cloudflare Workers edge runtime.

import { getDbHttp } from "@/lib/db";
import { file as fileTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export type FileDeletionActor = {
  id: number;
  role?: string | null;
};

/**
 * Hard-deletes a file: removes the R2 object (best-effort — a storage
 * error doesn't block the DB delete), deletes the File row, and writes an AuditLog entry.
 * Returns null if the file doesn't exist (already deleted).
 */
export async function deleteFileHard(fileId: string, actor: FileDeletionActor) {
  const db = getDbHttp();
  const [file] = await db
    .select({
      id: fileTable.id,
      name: fileTable.name,
      s3Key: fileTable.s3Key,
      taskId: fileTable.taskId,
    })
    .from(fileTable)
    .where(eq(fileTable.id, fileId))
    .limit(1);

  if (!file) return null;

  if (file.s3Key) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || "e8-app-r2-prod",
          Key: file.s3Key,
        })
      );
    } catch (s3Error) {
      console.error("R2 delete failed (continuing):", s3Error);
    }
  }

  await db.delete(fileTable).where(eq(fileTable.id, fileId));

  try {
    await createAuditLog({
      userId: actor.id,
      action: AuditAction.FILE_DELETED,
      entity: "File",
      entityId: fileId,
      details: `Deleted "${file.name}" from task ${file.taskId}`,
      metadata: {
        taskId: file.taskId,
        fileName: file.name,
        s3Key: file.s3Key,
        deletedByRole: actor.role,
      },
    });
  } catch (auditError) {
    console.error("Audit log write failed (file already deleted):", auditError);
  }

  return file;
}