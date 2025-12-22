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
      userId 
    } = await request.json();

    if (!key || !uploadId || !parts || !taskId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Complete the multipart upload on S3
    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await s3Client.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;

    // Save file record to database
    const fileRecord = await prisma.file.create({
      data: {
        taskId,
        name: fileName,
        url: fileUrl,
        mimeType: fileType,
        size: fileSize,
      },
    });

    // Add file URL to task.driveLinks
    await prisma.task.update({
      where: { id: taskId },
      data: {
        driveLinks: { push: fileUrl },
      },
    });

    return NextResponse.json({
      success: true,
      fileUrl,
      fileId: fileRecord.id,
      fileName: fileRecord.name,
    });
  } catch (error: any) {
    console.error('Error completing upload:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload', message: error.message },
      { status: 500 }
    );
  }
}