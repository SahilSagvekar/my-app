// src/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { file as fileTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getCurrentUser2 } from '@/lib/auth';
import { roleRequiresDeleteTotp, verifyUserTotp } from '@/lib/totp';

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional JSON body may include totpCode for authenticator-gated deletes
    let totpCode: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.totpCode === "string") totpCode = body.totpCode;
    } catch {
      // DELETE with empty body is fine for clients / legacy callers
    }

    const { id } = await params;

    // Get file with task info
    const file = await db.query.file.findFirst({
      where: eq(fileTable.id, id),
      with: {
        task: {
          columns: {
            id: true,
            assignedTo: true,
            clientId: true,
            status: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check permission: admin only (managers and editors cannot delete)
    const canDelete = user.role === "admin";

    if (!canDelete) {
      return NextResponse.json({ error: "Not authorized to delete this file" }, { status: 403 });
    }

    // Admins must confirm with Google Authenticator before destructive deletes
    if (roleRequiresDeleteTotp(user.role)) {
      const totp = await verifyUserTotp(user.id, totpCode);
      if (!totp.ok) {
        const status =
          totp.code === "MISSING" || totp.code === "NOT_SETUP" || totp.code === "NOT_ENABLED"
            ? 403
            : 401;
        return NextResponse.json(
          { error: totp.error, code: totp.code, requiresTotp: true },
          { status }
        );
      }
    }

    // Admins can delete regardless of task status (QC/Completed/Posted/Scheduled
    // included) — the locked statuses check that used to block this for
    // admin+manager only applied to non-admin deletion; now that this route is
    // admin-only, there's no separate non-admin path left for it to guard.

    // Delete from R2 if s3Key exists
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
        // Continue even if R2 delete fails
      }
    }

    // Delete from database
    await db.delete(fileTable).where(eq(fileTable.id, id));

    return NextResponse.json({ success: true, message: "File deleted" });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
