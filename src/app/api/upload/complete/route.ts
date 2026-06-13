export const dynamic = "force-dynamic";
// app/api/upload/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { queueVideoForCompression } from "@/lib/video-compression/worker";
import { updateClientStorageAfterUpload } from "@/lib/storage-service";
import { sendUploadNotification } from "@/lib/upload-notifications";
import { getCurrentUser2 } from "@/lib/auth";
import { getFileUrl } from "@/lib/s3";
import { completeMultipart, generateFileServerToken } from '@/lib/file-server';
import { createAuditLog, AuditAction } from "@/lib/audit-logger";
import jwt from "jsonwebtoken";

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
      // For single-PUT uploads (files < 16 MB), the file is already in R2 —
      // skip CompleteMultipartUpload and use the fileUrl passed from the client.
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

      // 🔥 Track storage for raw-footage uploads
      const isRawFootageUpload = key.includes("raw-footage");
      if (isRawFootageUpload && fileSize) {
        const pathParts = key.split("/");
        const companyName = pathParts[0];
        const client = await prisma.client.findFirst({
          where: { OR: [{ companyName }, { name: companyName }] },
          select: { id: true },
        });
        if (client) {
          const storageResult = await updateClientStorageAfterUpload(client.id, fileSize);
          console.log(`📊 Storage updated for ${companyName}: ${storageResult.storageInfo.usedFormatted} / ${storageResult.storageInfo.limitFormatted} (${storageResult.storageInfo.percentage.toFixed(1)}%)`);
        }
      }

      if (taskId === "drive-upload") {
        console.log("📂 Drive upload completed, skipping DB updates");
        if (userId) {
          const pathParts = key.split("/").filter(Boolean);
          const companyName = pathParts[0];
          let clientIdForNotification: string | undefined;
          if (companyName) {
            const client = await prisma.client.findFirst({
              where: { OR: [{ companyName }, { name: companyName }] },
              select: { id: true },
            });
            clientIdForNotification = client?.id;
          }
          sendUploadNotification({
            fileName,
            fileSize: fileSize || 0,
            uploadedBy: userId,
            clientId: clientIdForNotification,
            folderType: "drive",
            s3Key: key,
          }).catch((err) => {
            console.error(`[DriveUpload] Slack notification failed:`, err);
          });
        }
        return NextResponse.json({
          success: true,
          fileUrl,
          fileName,
          etag: s3Response.ETag,
          location: s3Response.Location,
        });
      }

      // 🔥 Determine folderType based on subfolder
      const folderType = !subfolder || subfolder === "main" ? "main" : subfolder;

      // ─── Parallel DB reads — fire all three at once, pay only one round-trip ───
      // existingActiveFile: needed for version bump
      // taskForDrive:       needed for Drive mirror decision (video uploads only)
      const [existingActiveFile, taskForDrive] = await Promise.all([
        prisma.file.findFirst({
          where: { taskId, folderType, isActive: true },
          orderBy: { version: "desc" },
        }),
        prisma.task.findUnique({
          where: { id: taskId },
          select: {
            requiresClientReview: true,
            outputFolderId: true,
            driveFolderId: true,
            clientId: true,
            client: { select: { companyName: true, name: true } },
          },
        }),
        // taskForNotif is a subset of taskForDrive — reuse the same result below
      ]);

      const newVersion = existingActiveFile ? existingActiveFile.version + 1 : 1;
      if (existingActiveFile) {
        console.log(`📦 Found existing v${existingActiveFile.version}, creating v${newVersion}`);
      }

      // ─── Create file record — proxyUrl set correctly in one write, no placeholder ───
      const fileRecord = await prisma.file.create({
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
          // proxyUrl needs the record ID — set via immediate update below
          proxyUrl: null,
        },
      });

      // Set proxyUrl now that we have the real ID — single targeted update
      if (fileType.startsWith("video/")) {
        await prisma.file.update({
          where: { id: fileRecord.id },
          data: { proxyUrl: `/api/files/${fileRecord.id}/stream` },
        });
      }

      console.log(`💾 File v${newVersion} saved:`, fileRecord.id);

      // ─── Drive mirror — data already in hand from the parallel read above ───
      if (fileType.startsWith("video/")) {
        const needsDriveMirror = taskForDrive?.requiresClientReview === true;
        console.log("needsDriveMirror:", needsDriveMirror);

        if (needsDriveMirror) {
          const _key = fileRecord.s3Key || key;
          const _driveFolderId = isLikelyGoogleDriveFolderId(taskForDrive?.driveFolderId)
            ? taskForDrive.driveFolderId
            : null;
          const _clientName = taskForDrive?.client?.companyName || taskForDrive?.client?.name || "Unknown Client";

          const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4000';
          // APP_URL must be reachable FROM THE FILE SERVER (different machine).
          // 127.0.0.1:3000 is wrong — it points to the file server's own loopback.
          // Set INTERNAL_APP_URL in this app's env to the e8-app private IP
          // or public URL: http://172.31.21.253:3000 or https://e8productions.com
          const APP_URL = process.env.INTERNAL_APP_URL
            || process.env.NEXTAUTH_URL
            || process.env.BASE_URL
            || 'https://e8productions.com';
          const token = generateFileServerToken(userId, user.role || 'editor');
          const callbackToken = jwt.sign(
            { purpose: 'drive-mirror-complete', fileRecordId: fileRecord.id },
            process.env.FILE_SERVER_SECRET || '',
            { expiresIn: '24h' },
          );
          const callbackUrl = new URL('/api/internal/drive-mirror-complete', APP_URL);
          callbackUrl.searchParams.set('token', callbackToken);

          // Fire-and-forget — file server handles the long-running stream
          fetch(`${FILE_SERVER_URL}/drive-mirror`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              key: _key,
              fileName,
              mimeType: fileType,
              folderId: _driveFolderId || undefined,
              clientName: _driveFolderId ? undefined : _clientName,
              fileRecordId: fileRecord.id,
              callbackUrl: callbackUrl.toString(),
            }),
          }).then(r => {
            if (!r.ok) r.text().then(t => console.error(`⚠️ Drive mirror dispatch failed: ${t}`));
            else console.log(`📡 Drive mirror dispatched to file server for "${fileName}"`);
          }).catch(err => {
            console.error(`⚠️ Drive mirror dispatch error: ${err.message}`);
          });
        }
      }

      // ─── Mark old file inactive + push driveLink — parallel writes ───
      await Promise.all([
        existingActiveFile
          ? prisma.file.update({
              where: { id: existingActiveFile.id },
              data: { isActive: false, replacedAt: new Date(), replacedBy: fileRecord.id },
            })
          : Promise.resolve(null),
        prisma.task.update({
          where: { id: taskId },
          data: { driveLinks: { push: fileUrl } },
        }),
      ]);

      if (existingActiveFile) {
        console.log(`📁 v${existingActiveFile.version} marked inactive, replaced by v${newVersion}`);
      }
      console.log("🔗 File URL added to task driveLinks");

      // Queue for compression if > 100MB (fire-and-forget)
      // if (fileType.startsWith("video/") && fileSize > 100 * 1024 * 1024) {
      //   queueVideoForCompression({
      //     videoKey: key,
      //     sizeBytes: fileSize,
      //     clientId: taskId,
      //     taskId,
      //   }).catch((err) => {
      //     console.error(`❌ Failed to queue compression: ${err}`);
      //   });
      // }

      // ─── Audit log + Slack notification — both fire-and-forget ───
      // clientId already fetched from taskForDrive, no extra query needed
      createAuditLog({
        userId,
        action: AuditAction.FILE_UPLOADED,
        entity: "File",
        entityId: fileRecord.id,
        details: `Uploaded file: ${fileName} (v${newVersion}) to folder: ${folderType}`,
        metadata: { taskId, fileName, fileSize, version: newVersion, folderType },
      }).catch((err) => {
        console.error(`[AuditLog] Failed to log upload:`, err);
      });

      if (userId) {
        sendUploadNotification({
          fileName,
          fileSize: fileSize || 0,
          uploadedBy: userId,
          clientId: taskForDrive?.clientId || undefined,
          taskId,
          folderType,
          s3Key: key,
        }).catch((err) => {
          console.error(`[UploadComplete] Slack notification failed:`, err);
        });
      }

      return NextResponse.json({
        success: true,
        fileUrl,
        fileId: fileRecord.id,
        fileName: fileRecord.name,
        version: newVersion,
        previousVersion: existingActiveFile ? existingActiveFile.version : null,
        etag: s3Response.ETag,
        location: s3Response.Location,
      });

    } catch (s3Error: unknown) {
      const s3ErrorCode = getErrorCode(s3Error);
      const s3ErrorMessage = getErrorMessage(s3Error);

      if (s3ErrorCode === "NoSuchUpload") {
        console.error("❌ Upload session expired or aborted:", { uploadId, key, fileName, error: s3ErrorMessage });
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
    console.error("❌ Error completing upload:", {
      error: message,
      code,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "Failed to complete upload",
        message,
        code,
      },
      { status: 500 },
    );
  }
}
