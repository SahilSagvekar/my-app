export const dynamic = 'force-dynamic';
// app/api/upload/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET, getFileUrl } from '@/lib/s3';
import { optimizeVideo } from '@/lib/video-optimizer';
import { queueVideoForCompression } from '@/lib/video-compression/worker';
import { updateClientStorageAfterUpload } from '@/lib/storage-service';

const s3Client = getS3();

export async function POST(request: NextRequest) {
  try {
    const {
      key,
      uploadId,
      parts,
      fileName,
      fileSize,
      fileType,
      taskId,
      userId,
      subfolder,
      codec
    } = await request.json();

    console.log("📥 Complete upload request:", {
      fileName,
      taskId,
      subfolder: subfolder || "main",
      uploadId,
      partsCount: parts?.length,
    });

    if (!key || !uploadId || !parts || !taskId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    try {
      // Complete the multipart upload on S3
      const command = new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });

      const s3Response = await s3Client.send(command);

      const fileUrl = getFileUrl(key);

      console.log("✅ S3 upload completed:", fileUrl);

      // 🔥 Track storage for raw-footage uploads
      const isRawFootageUpload = key.includes('raw-footage');
      if (isRawFootageUpload && fileSize) {
        // Extract client ID from the S3 key path (CompanyName/raw-footage/...)
        const pathParts = key.split('/');
        const companyName = pathParts[0];
        
        // Find client by company name
        const client = await prisma.client.findFirst({
          where: {
            OR: [
              { companyName: companyName },
              { name: companyName }
            ]
          },
          select: { id: true }
        });
        
        if (client) {
          const storageResult = await updateClientStorageAfterUpload(client.id, fileSize);
          console.log(`📊 Storage updated for ${companyName}: ${storageResult.storageInfo.usedFormatted} / ${storageResult.storageInfo.limitFormatted} (${storageResult.storageInfo.percentage.toFixed(1)}%)`);
        }
      }

      if (taskId === "drive-upload") {
        console.log("📂 Drive upload completed, skipping DB updates");
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
        where: {
          taskId: taskId,
          folderType: folderType,
          isActive: true,
        },
        orderBy: {
          version: 'desc', // Get highest version
        },
      });

      let newVersion = 1;

      // 2. If active file exists, mark it as inactive
      if (existingActiveFile) {
        newVersion = existingActiveFile.version + 1;
        console.log(`📦 Found existing v${existingActiveFile.version}, creating v${newVersion}`);
      }

      // 3. Create new file record with version
      const fileRecord = await prisma.file.create({
        data: {
          name: fileName,
          url: fileUrl,
          s3Key: key,
          mimeType: fileType,
          size: fileSize,
          taskId: taskId,
          uploadedBy: userId,
          folderType: folderType,
          version: newVersion,
          isActive: true,
          codec: codec,
          proxyUrl: fileType.startsWith('video/') ? `/api/files/NEW_ID_PLACEHOLDER/stream` : null,
        },
      });

      // Update the placeholder with the actual ID
      if (fileRecord.proxyUrl === `/api/files/NEW_ID_PLACEHOLDER/stream`) {
        await prisma.file.update({
          where: { id: fileRecord.id },
          data: { proxyUrl: `/api/files/${fileRecord.id}/stream` }
        });
      }

      console.log(`💾 File v${newVersion} saved:`, fileRecord.id);

      // 4. Now update old file with replacedBy reference
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

      // Add file URL to task.driveLinks (only if not already there)
      await prisma.task.update({
        where: { id: taskId },
        data: {
          driveLinks: { push: fileUrl },
        },
      });

      console.log("🔗 File URL added to task driveLinks");

      // 🔥 TRIGGER BACKGROUND OPTIMIZATION
      // if (fileType.startsWith('video/')) {
      //   console.log(`🚀 Triggering background optimization for file: ${fileRecord.id}`);
      //   // Set initial status
      //   await prisma.file.update({
      //     where: { id: fileRecord.id },
      //     data: { optimizationStatus: 'PENDING' }
      //   });
        
      //   // We don't await this so it doesn't block the response
      //   optimizeVideo(fileRecord.id).catch(err => {
      //     console.error(`❌ Background optimization failed for ${fileRecord.id}:`, err);
      //   });
      // }

      if (fileType.startsWith("video/") && fileSize > 100 * 1024 * 1024) {
        // Queue for spot compression if > 100MB
        queueVideoForCompression({
          videoKey: key,
          sizeBytes: fileSize,
          clientId: taskId, // or actual clientId if available
          taskId: taskId,
        }).catch((err) => {
          console.error(`❌ Failed to queue compression: ${err}`);
        });
      }

      // 🔥 LOG ACTIVITY
      const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
      await createAuditLog({
        userId: userId,
        action: AuditAction.FILE_UPLOADED,
        entity: 'File',
        entityId: fileRecord.id,
        details: `Uploaded file: ${fileName} (v${newVersion}) to folder: ${folderType}`,
        metadata: {
          taskId,
          fileName,
          fileSize,
          version: newVersion,
          folderType
        }
      });

      return NextResponse.json({
        success: true,
        fileUrl,
        fileId: fileRecord.id,
        fileName: fileRecord.name,
        version: newVersion, // 🔥 Return version info
        previousVersion: existingActiveFile ? existingActiveFile.version : null,
        etag: s3Response.ETag,
        location: s3Response.Location,
      });

    } catch (s3Error: any) {
      // Handle NoSuchUpload error specifically
      if (s3Error.Code === 'NoSuchUpload' || s3Error.name === 'NoSuchUpload') {
        console.error("❌ Upload session expired or aborted:", {
          uploadId,
          key,
          fileName,
          error: s3Error.message,
        });

        return NextResponse.json(
          {
            error: 'Upload session expired',
            message: 'The upload session has expired or was aborted. Please restart the upload.',
            code: 'UPLOAD_EXPIRED',
            details: {
              uploadId,
              fileName,
              reason: s3Error.message,
            }
          },
          { status: 410 }
        );
      }

      if (s3Error.Code === 'InvalidPart' || s3Error.name === 'InvalidPart') {
        console.error("❌ Invalid part error:", {
          uploadId,
          key,
          error: s3Error.message,
        });

        return NextResponse.json(
          {
            error: 'Invalid upload part',
            message: 'One or more upload parts are invalid. Please restart the upload.',
            code: 'INVALID_PART',
          },
          { status: 400 }
        );
      }

      throw s3Error;
    }

  } catch (error: any) {
    console.error('❌ Error completing upload:', {
      error: error.message,
      code: error.Code || error.name,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to complete upload',
        message: error.message || 'An unexpected error occurred',
        code: error.Code || error.name || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}