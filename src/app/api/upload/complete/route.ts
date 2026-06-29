export const dynamic = "force-dynamic";
// app/api/upload/complete/route.ts
//
// WHAT THIS ROUTE DOES (synchronous — browser waits for these):
//   1. Tell R2 to assemble the uploaded chunks
//   2. Create the file record in DB (so file appears immediately in UI)
//   3. Mark old version inactive + push fileUrl to task.driveLinks
//   4. Return success + fileId to browser
//
// WHAT THE BACKGROUND WORKER DOES (async — browser doesn't wait):
//   - Storage usage update
//   - Google Drive mirror dispatch
//   - Slack upload notification
//   - Audit log

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";
import { getFileUrl } from "@/lib/s3";
import { completeMultipart, invalidateCache } from '@/lib/file-server';
import { pushUploadJob } from '@/lib/upload-queue';
import { prisma } from "@/lib/prisma";

function isLikelyGoogleDriveFolderId(value?: string | null): value is string {
  return !!value && !value.includes("/") && !value.includes("\\");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as { Code?: unknown; name?: unknown };
    if (typeof record.Code === "string") return record.Code;
    if (typeof record.name === "string") return record.name;
  }
  return "UNKNOWN_ERROR";
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser2(request);
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const userId = user.id;

    const {
      key,
      uploadId,
      parts,
      fileName,
      fileSize,
      fileType,
      taskId,
      subfolder,
      codec,
      singlePut,
      fileUrl: singlePutFileUrl,
      taggedEditorIds,
    } = await request.json();

    console.log("📥 Complete request:", {
      fileName,
      taskId,
      subfolder: subfolder || "main",
      uploadId,
      partsCount: parts?.length,
      singlePut: !!singlePut,
      userId,
    });

    if (!key || !uploadId || !taskId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    try {
      // ── STEP 1: Tell R2 to assemble the file ─────────────────────────────
      let s3Response: { ETag?: string; Location?: string } = {};
      let fileUrl: string;

      if (singlePut) {
        fileUrl = singlePutFileUrl || getFileUrl(key);
        console.log("✅ Single PUT already complete:", fileUrl);
      } else {
        if (!parts) {
          return NextResponse.json({ error: "Missing parts for multipart complete" }, { status: 400 });
        }
        s3Response = await completeMultipart(userId, user.role || 'admin', key, uploadId, parts);
        fileUrl = getFileUrl(key);
        console.log("✅ S3 multipart completed:", fileUrl);
      }

      const isDriveUpload = taskId === "drive-upload";

      // ── STEP 2: DB reads — task info + existing file version ──────────────
      let driveFolderId: string | null = null;
      let clientName: string | null = null;
      let requiresClientReview = false;
      let clientId: string | null = null;
      let existingActiveFile: { id: string; version: number } | null = null;

      if (!isDriveUpload) {
        const [taskResult, existingFile] = await Promise.all([
          prisma.task.findUnique({
            where: { id: taskId },
            select: {
              requiresClientReview: true,
              driveFolderId: true,
              clientId: true,
              client: { select: { companyName: true, name: true } },
            },
          }),
          prisma.file.findFirst({
            where: {
              taskId,
              folderType: !subfolder || subfolder === 'main' ? 'main' : subfolder,
              isActive: true,
            },
            orderBy: { version: 'desc' },
            select: { id: true, version: true },
          }),
        ]);

        if (taskResult) {
          requiresClientReview = taskResult.requiresClientReview === true;
          driveFolderId = isLikelyGoogleDriveFolderId(taskResult.driveFolderId)
            ? taskResult.driveFolderId
            : null;
          clientName = taskResult.client?.companyName || taskResult.client?.name || null;
          clientId = taskResult.clientId || null;
        }
        existingActiveFile = existingFile;
      } else {
        const pathParts = key.split("/").filter(Boolean);
        const companyName = pathParts[0];
        if (companyName) {
          const client = await prisma.client.findFirst({
            where: { OR: [{ companyName }, { name: companyName }] },
            select: { id: true },
          });
          clientId = client?.id || null;
        }
      }

      // ── STEP 3: Create file record — file appears in UI immediately ───────
      const folderType = !subfolder || subfolder === 'main' ? 'main' : subfolder;
      const newVersion = existingActiveFile ? existingActiveFile.version + 1 : 1;

      let fileRecord: { id: string; version: number } | null = null;

      if (!isDriveUpload) {
        fileRecord = await prisma.file.create({
          data: {
            name: fileName,
            url: fileUrl,
            s3Key: key,
            mimeType: fileType,
            size: fileSize,
            taskId,
            uploadedBy: userId,
            folderType,
            version: newVersion,
            isActive: true,
            codec,
            proxyUrl: fileType.startsWith('video/')
              ? null  // set after we have the ID
              : null,
          },
          select: { id: true, version: true },
        });

        // Set proxyUrl now that we have the real ID
        if (fileType.startsWith('video/')) {
          await prisma.file.update({
            where: { id: fileRecord.id },
            data: { proxyUrl: `/api/files/${fileRecord.id}/stream` },
          });
        }

        console.log(`💾 File v${newVersion} saved: ${fileRecord.id}`);

        // ── STEP 4: Mark old version inactive + push fileUrl ─────────────
        await Promise.all([
          existingActiveFile
            ? prisma.file.update({
                where: { id: existingActiveFile.id },
                data: {
                  isActive: false,
                  replacedAt: new Date(),
                  replacedBy: fileRecord.id,
                },
              })
            : Promise.resolve(null),
          prisma.task.update({
            where: { id: taskId },
            data: { driveLinks: { push: fileUrl } },
          }),
        ]);

        if (existingActiveFile) {
          console.log(`📁 v${existingActiveFile.version} → replaced by v${newVersion}`);
        }
      }

      // ── STEP 5: Push background job — storage, Drive, Slack, audit ───────
      const jobId = await pushUploadJob({
        key,
        fileUrl,
        fileName,
        fileSize,
        fileType,
        taskId,
        subfolder: subfolder || 'main',
        codec,
        userId,
        userRole: user.role || 'editor',
        driveFolderId,
        clientName,
        requiresClientReview,
        clientId,
        isDriveUpload,
        // Pass fileRecordId so worker doesn't need to re-create the file
        fileRecordId: fileRecord?.id || null,
        // Admin-selected editors to tag in Slack — falls back to auto-tag-all if omitted
        taggedEditorIds: Array.isArray(taggedEditorIds) && taggedEditorIds.length > 0 ? taggedEditorIds : null,
      });

      console.log(`📬 Background job queued: ${jobId} for ${fileName}`);

      // ── STEP 6: Bust file server cache so the new file shows immediately ───
      // The file server caches the folder tree per (role, prefix). Sending no
      // prefix triggers invalidateAll() on the file server — clears every role's
      // cache at once. Safe: cache rebuilds on next request (~1-2s cold hit).
      // Without this, the UI reloads a stale tree and the new file stays
      // invisible until the 5-min TTL expires.
      try {
        await invalidateCache(userId, user.role || 'admin'); // no prefix = invalidateAll on file server
      } catch (cacheErr) {
        // Non-fatal — worst case stale data for up to 5 minutes
        console.warn('⚠️  Cache invalidation failed (non-fatal):', cacheErr);
      }

      // ── STEP 7: Return success — file is already in DB ────────────────────
      return NextResponse.json({
        success: true,
        fileUrl,
        fileId: fileRecord?.id,
        fileName,
        version: newVersion,
        previousVersion: existingActiveFile ? existingActiveFile.version : null,
        jobId,
        etag: s3Response.ETag,
        location: s3Response.Location,
      });

    } catch (s3Error: unknown) {
      const s3ErrorCode = getErrorCode(s3Error);
      const s3ErrorMessage = getErrorMessage(s3Error);

      if (s3ErrorCode === "NoSuchUpload") {
        console.error("❌ Upload session expired:", { uploadId, key, fileName, error: s3ErrorMessage });
        return NextResponse.json(
          {
            error: "Upload session expired",
            message: "The upload session has expired or was aborted. Please restart the upload.",
            code: "UPLOAD_EXPIRED",
            details: { uploadId, fileName, reason: s3ErrorMessage },
          },
          { status: 410 },
        );
      }

      if (s3ErrorCode === "InvalidPart") {
        console.error("❌ Invalid part error:", { uploadId, key, error: s3ErrorMessage });
        return NextResponse.json(
          {
            error: "Invalid upload part",
            message: "One or more upload parts are invalid. Please restart the upload.",
            code: "INVALID_PART",
          },
          { status: 400 },
        );
      }

      throw s3Error;
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const code = getErrorCode(error);
    console.error("❌ Error completing upload:", { error: message, code });
    return NextResponse.json(
      { error: "Failed to complete upload", message, code },
      { status: 500 },
    );
  }
}