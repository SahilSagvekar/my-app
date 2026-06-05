export const dynamic = "force-dynamic";
// app/api/upload/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
// import { CompleteMultipartUploadCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
// import { getS3, BUCKET, getFileUrl } from "@/lib/s3";
import { queueVideoForCompression } from "@/lib/video-compression/worker";
import { updateClientStorageAfterUpload } from "@/lib/storage-service";
import { sendUploadNotification } from "@/lib/upload-notifications";
import { getCurrentUser2 } from "@/lib/auth";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3, BUCKET, getFileUrl } from "@/lib/s3";
import { completeMultipart } from '@/lib/file-server';

const s3Client = getS3();

function isLikelyGoogleDriveFolderId(value?: string | null): value is string {
  return !!value && !value.includes("/") && !value.includes("\\");
}

async function getCompletedObjectWithRetry(key: string) {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw new Error(`File not found after upload completion: ${key}`);
}

function describeDriveMirrorError(err: any): string {
  const message = err?.message || String(err);
  if (message.includes("Service Accounts do not have storage quota")) {
    return `${message} Configure GOOGLE_REFRESH_TOKEN/GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET for OAuth-owned uploads, or set GOOGLE_DRIVE_PARENT_ID to a Shared Drive folder that the service account can access.`;
  }
  return message;
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
    } = await request.json();

    console.log("📥 Complete request:", {
      fileName,
      taskId,
      subfolder: subfolder || "main",
      uploadId,
      partsCount: parts?.length,
      userId,
    });

    if (!key || !uploadId || !parts || !taskId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    try {
      // Complete the multipart upload on S3
      // const command = new CompleteMultipartUploadCommand({
      //   Bucket: BUCKET,
      //   Key: key,
      //   UploadId: uploadId,
      //   MultipartUpload: { Parts: parts },
      // });

      // const s3Response = await s3Client.send(command);
      // const fileUrl = getFileUrl(key);

      // Complete the multipart upload via file server
      const { completeMultipart } = await import('@/lib/file-server');
      const s3Response = await completeMultipart(userId, user.role || 'admin', key, uploadId, parts);
      const fileUrl = getFileUrl(key);

      console.log("✅ S3 upload completed:", fileUrl);

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

      // 1. Find the current active file for this task + folderType
      const existingActiveFile = await prisma.file.findFirst({
        where: { taskId, folderType, isActive: true },
        orderBy: { version: "desc" },
      });

      let newVersion = 1;
      if (existingActiveFile) {
        newVersion = existingActiveFile.version + 1;
        console.log(`📦 Found existing v${existingActiveFile.version}, creating v${newVersion}`);
      }

      // 2. Create new file record with version
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
          proxyUrl: fileType.startsWith("video/")
            ? `/api/files/NEW_ID_PLACEHOLDER/stream`
            : null,
        },
      });

      // Update the placeholder with the actual ID
      if (fileRecord.proxyUrl === `/api/files/NEW_ID_PLACEHOLDER/stream`) {
        await prisma.file.update({
          where: { id: fileRecord.id },
          data: { proxyUrl: `/api/files/${fileRecord.id}/stream` },
        });
      }

      console.log(`💾 File v${newVersion} saved:`, fileRecord.id);

      // 🔥 Mirror video to Google Drive for lag-free client review playback
      if (fileType.startsWith("video/")) {
        const taskForDrive = await prisma.task.findUnique({
          where: { id: taskId },
          select: {
            requiresClientReview: true,
            outputFolderId: true,
            driveFolderId: true,
            client: { select: { companyName: true, name: true } },
          },
        });

        const needsDriveMirror = taskForDrive?.requiresClientReview === true;
        console.log("needsDriveMirror:", needsDriveMirror);

        if (needsDriveMirror) {
          const _key = fileRecord.s3Key || key;
          const _fileName = fileName;
          const _fileType = fileType;
          const _fileRecordId = fileRecord.id;
          const _driveFolderId = isLikelyGoogleDriveFolderId(taskForDrive?.driveFolderId)
            ? taskForDrive.driveFolderId
            : null;
          const _clientName = taskForDrive?.client?.companyName || taskForDrive?.client?.name || "Unknown Client";

          // Fire-and-forget — don't block the upload response
          (async () => {
            try {
              if (_key.endsWith("/") || _key.endsWith("/.")) {
                console.warn(`⚠️ Drive mirror skipped — key looks like a folder: "${_key}"`);
                return;
              }

              // Wait for R2 eventual consistency after multipart complete
              await new Promise(resolve => setTimeout(resolve, 1500));

              console.log(`☁️ Mirroring ${_fileName} to Google Drive for client review...`);

              // Resolve Drive folder
              let targetFolderId = _driveFolderId;
              if (!targetFolderId) {
                console.log(`📁 No Drive folder on task — using fallback folder for "${_clientName}"`);
                const { getOrCreateReviewFolder } = await import("@/lib/googleDrive");
                targetFolderId = await getOrCreateReviewFolder(_clientName);
                console.log(`📁 Resolved target Drive folder: ${targetFolderId}`);
              }

              // Stream from R2
              console.log(`⬇️ Streaming from R2 → Drive | key: "${_key}"`);
              const r2Object = await getCompletedObjectWithRetry(_key);
              if (!r2Object.Body) throw new Error("Empty response from R2");

              // Collect into buffer
              const chunks: Uint8Array[] = [];
              for await (const chunk of r2Object.Body as any) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              const buf = Buffer.concat(chunks);

              // Upload to Drive using service account
              const { uploadBufferToDrive } = await import("@/lib/googleDrive");
              const driveRes = await uploadBufferToDrive({
                buffer: buf,
                folderId: targetFolderId,
                filename: _fileName,
                mimeType: _fileType,
              });

              const driveFileId = driveRes.id;
              if (driveFileId) {
                const reviewDriveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
                await prisma.file.update({
                  where: { id: _fileRecordId },
                  data: { reviewDriveUrl },
                });
                console.log(`✅ Drive mirror complete: ${reviewDriveUrl}`);
              }
            } catch (driveErr: any) {
              console.error(`⚠️ Drive mirror failed (R2 fallback active): ${describeDriveMirrorError(driveErr)} | key was: "${_key}" | fileName: "${_fileName}" | errorCode: ${driveErr.Code || driveErr.code || driveErr.name} | httpStatus: ${driveErr.$metadata?.httpStatusCode}`);
            }
          })();
        }
      }

      // 3. Mark old file as inactive
      if (existingActiveFile) {
        await prisma.file.update({
          where: { id: existingActiveFile.id },
          data: {
            isActive: false,
            replacedAt: new Date(),
            replacedBy: fileRecord.id,
          },
        });
        console.log(`📁 v${existingActiveFile.version} marked inactive, replaced by v${newVersion}`);
      }

      // Add file URL to task.driveLinks
      await prisma.task.update({
        where: { id: taskId },
        data: { driveLinks: { push: fileUrl } },
      });

      console.log("🔗 File URL added to task driveLinks");

      // Queue for compression if > 100MB
      if (fileType.startsWith("video/") && fileSize > 100 * 1024 * 1024) {
        queueVideoForCompression({
          videoKey: key,
          sizeBytes: fileSize,
          clientId: taskId,
          taskId,
        }).catch((err) => {
          console.error(`❌ Failed to queue compression: ${err}`);
        });
      }

      // 🔥 LOG ACTIVITY
      const { createAuditLog, AuditAction } = await import("@/lib/audit-logger");
      await createAuditLog({
        userId,
        action: AuditAction.FILE_UPLOADED,
        entity: "File",
        entityId: fileRecord.id,
        details: `Uploaded file: ${fileName} (v${newVersion}) to folder: ${folderType}`,
        metadata: { taskId, fileName, fileSize, version: newVersion, folderType },
      });

      // 🔥 SEND SLACK NOTIFICATION
      const taskForNotification = await prisma.task.findUnique({
        where: { id: taskId },
        select: { clientId: true },
      });

      if (userId) {
        sendUploadNotification({
          fileName,
          fileSize: fileSize || 0,
          uploadedBy: userId,
          clientId: taskForNotification?.clientId || undefined,
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

    } catch (s3Error: any) {
      if (s3Error.Code === "NoSuchUpload" || s3Error.name === "NoSuchUpload") {
        console.error("❌ Upload session expired or aborted:", { uploadId, key, fileName, error: s3Error.message });
        return NextResponse.json(
          {
            error: "Upload session expired",
            message: "The upload session has expired or was aborted. Please restart the upload.",
            code: "UPLOAD_EXPIRED",
            details: { uploadId, fileName, reason: s3Error.message },
          },
          { status: 410 },
        );
      }

      if (s3Error.Code === "InvalidPart" || s3Error.name === "InvalidPart") {
        console.error("❌ Invalid part error:", { uploadId, key, error: s3Error.message });
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
  } catch (error: any) {
    console.error("❌ Error completing upload:", {
      error: error.message,
      code: error.Code || error.name,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        error: "Failed to complete upload",
        message: error.message || "An unexpected error occurred",
        code: error.Code || error.name || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}