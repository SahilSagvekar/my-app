// src/lib/file-deletion.ts
//
// The actual "delete a file" mechanics (R2 object + DB row + audit log),
// factored out so DELETE /api/files/[id] (admin/videographer direct
// delete) and the deletion-request approval route both go through the
// exact same path instead of two copies drifting apart.

import { prisma } from "@/lib/prisma";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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
 * error doesn't block the DB delete, matching the original route's
 * behavior), deletes the File row, and writes an AuditLog entry.
 * Returns null if the file doesn't exist (already deleted).
 */
export async function deleteFileHard(fileId: string, actor: FileDeletionActor) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { task: { select: { id: true } } },
  });

  if (!file) return null;

  if (file.s3Key) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: file.s3Key,
        })
      );
    } catch (s3Error) {
      console.error("R2 delete failed (continuing):", s3Error);
    }
  }

  await prisma.file.delete({ where: { id: fileId } });

  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "file_deleted",
        entity: "File",
        entityId: fileId,
        details: `Deleted "${file.name}" from task ${file.task.id}`,
        metadata: {
          taskId: file.task.id,
          fileName: file.name,
          s3Key: file.s3Key,
          deletedByRole: actor.role,
        },
      },
    });
  } catch (auditError) {
    console.error("Audit log write failed (file already deleted):", auditError);
  }

  return file;
}