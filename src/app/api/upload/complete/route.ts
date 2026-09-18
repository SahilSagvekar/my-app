export const dynamic = "force-dynamic";
// app/api/upload/complete/route.ts
//
// WHAT THIS ROUTE DOES (synchronous — browser waits for these):
//   1. Tell R2 to assemble the uploaded chunks
//   2. Create the file record in DB (so file appears immediately in UI)
//   3. For single-asset folders (e.g. main video), mark old version inactive
//      Multi-asset folders (thumbnails, music-license, covers, tiles) keep
//      every upload active so editors can attach more than one.
//   4. Push fileUrl to task.driveLinks
//   5. Return success + fileId to browser
//
// WHAT THE BACKGROUND WORKER DOES (async — browser doesn't wait):
//   - Storage usage update
//   - Google Drive mirror dispatch
//   - Slack upload notification
//   - Audit log

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";
import { getFileUrl } from "@/lib/s3";
import { completeMultipart, requestMediaPreviewGeneration } from '@/lib/file-server';
import { pushUploadJob } from '@/lib/upload-queue';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDbHttp } from "@/lib/db";
import { client as clientTable, file as fileTable, mediaPreview, task as taskTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { isMultiAssetFolderType, shouldVersionReplaceUpload } from "@/lib/file-folder-types";

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
  const db = getDbHttp();
  const { env } = getCloudflareContext();
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
      batchId,
      batchTotal,
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
        s3Response = await completeMultipart(env, userId, user.role || 'admin', key, uploadId, parts);
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
        const [taskResult, [existingFile]] = await Promise.all([
          db.query.task.findFirst({
            where: eq(taskTable.id, taskId),
            columns: {
              requiresClientReview: true,
              driveFolderId: true,
              clientId: true,
              assignedTo: true,
              thumbnailEditor: true,
            },
            with: {
              client: { columns: { companyName: true, name: true } },
            },
          }),
          db
            .select({ id: fileTable.id, version: fileTable.version })
            .from(fileTable)
            .where(
              and(
                eq(fileTable.taskId, taskId),
                eq(fileTable.folderType, !subfolder || subfolder === 'main' ? 'main' : subfolder),
                eq(fileTable.isActive, true),
              ),
            )
            .orderBy(desc(fileTable.version))
            .limit(1),
        ]);

        if (taskResult) {
          requiresClientReview = taskResult.requiresClientReview === true;
          driveFolderId = isLikelyGoogleDriveFolderId(taskResult.driveFolderId)
            ? taskResult.driveFolderId
            : null;
          clientName = taskResult.client?.companyName || taskResult.client?.name || null;
          clientId = taskResult.clientId || null;

          // 🔒 Same video-editor-vs-thumbnail-editor gate as /api/upload/initiate
          // — defense in depth, since this is the route that actually creates
          // the app-visible File row. Only enforced for the 'editor' role.
          const role = (user.role || '').toLowerCase();
          if (role === 'editor') {
            const currentUserId = Number(userId);
            const isThumbnailUpload = subfolder === 'thumbnails';
            const allowed = isThumbnailUpload
              ? currentUserId === taskResult.thumbnailEditor || (!taskResult.thumbnailEditor && currentUserId === taskResult.assignedTo)
              : currentUserId === taskResult.assignedTo;

            if (!allowed) {
              return NextResponse.json(
                {
                  message: isThumbnailUpload
                    ? 'Only the editor assigned to the thumbnail can upload it for this task.'
                    : 'Only the editor assigned to the main video can upload it for this task.',
                },
                { status: 403 },
              );
            }
          }
        }
        existingActiveFile = existingFile ?? null;
      } else {
        const pathParts = key.split("/").filter(Boolean);
        const companyName = pathParts[0];
        if (companyName) {
          const [foundClient] = await db
            .select({ id: clientTable.id })
            .from(clientTable)
            .where(or(eq(clientTable.companyName, companyName), eq(clientTable.name, companyName)))
            .limit(1);
          clientId = foundClient?.id || null;
        }
      }

      // ── STEP 3: Create file record — file appears in UI immediately ───────
      const folderType = !subfolder || subfolder === 'main' ? 'main' : subfolder;
      const keepPreviousAssets = !shouldVersionReplaceUpload(folderType, fileType);
      const newVersion = existingActiveFile ? existingActiveFile.version + 1 : 1;

      let fileRecord: { id: string; version: number } | null = null;

      if (!isDriveUpload) {
        const [insertedFile] = await db
          .insert(fileTable)
          .values({
            id: createId(),
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
            uploadedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          })
          .returning({ id: fileTable.id, version: fileTable.version });
        fileRecord = insertedFile;

        // Set proxyUrl now that we have the real ID
        if (fileType.startsWith('video/')) {
          await db
            .update(fileTable)
            .set({ proxyUrl: `/api/files/${fileRecord.id}/stream` })
            .where(eq(fileTable.id, fileRecord.id));
        }

        console.log(
          `💾 File v${newVersion} saved: ${fileRecord.id}` +
            (keepPreviousAssets ? ' (keep previous assets)' : ''),
        );

        // ── STEP 4: Optionally mark old version inactive + push fileUrl ──
        // Multi-asset folders + image uploads (Hard Posts on main, etc.) keep
        // every file active. Main videos still version-replace.
        await Promise.all([
          existingActiveFile && !keepPreviousAssets
            ? db
                .update(fileTable)
                .set({
                  isActive: false,
                  replacedAt: new Date().toISOString(),
                  replacedBy: fileRecord.id,
                })
                .where(eq(fileTable.id, existingActiveFile.id))
            : Promise.resolve(null),
          db
            .update(taskTable)
            .set({
              driveLinks: sql`array_append(${taskTable.driveLinks}, ${fileUrl})`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(taskTable.id, taskId)),
        ]);

        if (existingActiveFile && !keepPreviousAssets) {
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
        // Part of a multi-file batch (2+ files selected together) — worker
        // groups these into one Slack notification instead of one per file.
        batchId: batchId || null,
        batchTotal: typeof batchTotal === 'number' && batchTotal > 0 ? batchTotal : null,
      });

      // Thumbnail extraction is owned by the dedicated file service (where
      // ffmpeg can run), never by this Worker. A queue failure must not turn a
      // successfully uploaded video into a failed upload; the processor can
      // backfill it later.
      if (fileType?.startsWith('video/')) {
        const now = new Date().toISOString();
        await db.insert(mediaPreview).values({
          id: createId(),
          s3Key: key,
          fileId: fileRecord?.id || null,
          taskId: isDriveUpload ? null : taskId,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: mediaPreview.s3Key,
          set: {
            fileId: fileRecord?.id || null,
            taskId: isDriveUpload ? null : taskId,
            status: 'PENDING',
            errorMessage: null,
            updatedAt: now,
          },
        });
        try {
          await requestMediaPreviewGeneration(env, userId, user.role || 'editor', {
            s3Key: key,
            fileId: fileRecord?.id || null,
            taskId: isDriveUpload ? null : taskId,
            mimeType: fileType,
          });
        } catch (previewError: unknown) {
          console.error('⚠️ Failed to queue media preview generation:', getErrorMessage(previewError));
        }
      }

      console.log(`📬 Background job queued: ${jobId} for ${fileName}`);

      // ── STEP 6: Return success — file is already in DB ────────────────────
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
