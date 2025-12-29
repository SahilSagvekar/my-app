// app/api/upload/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
      subfolder // 🔥 ADD THIS - receive from request body
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
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });

      const s3Response = await s3Client.send(command);

      const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;

      console.log("✅ S3 upload completed:", fileUrl);

      // 🔥 Determine folderType based on subfolder
      const folderType = !subfolder || subfolder === "main" ? "main" : subfolder;

      // Save file record to database
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
        },
      });

      console.log("💾 File record saved to database:", fileRecord.id);

      // Add file URL to task.driveLinks
      await prisma.task.update({
        where: { id: taskId },
        data: {
          driveLinks: { push: fileUrl },
        },
      });

      console.log("🔗 File URL added to task driveLinks");

      return NextResponse.json({
        success: true,
        fileUrl,
        fileId: fileRecord.id,
        fileName: fileRecord.name,
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
          { status: 410 } // 410 Gone - resource no longer available
        );
      }

      // Handle other S3-specific errors
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

      // Re-throw other S3 errors to be caught by outer catch
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