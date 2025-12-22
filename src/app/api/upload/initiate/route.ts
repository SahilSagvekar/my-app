// app/api/upload/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
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
    const { fileName, fileType, taskId, clientId, folderType } = await request.json();
    
    // Validate required fields
    if (!fileName || !fileType || !taskId || !clientId || !folderType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client folder prefix
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        rawFootageFolderId: true,
        essentialsFolderId: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const folderPrefix =
      folderType === 'rawFootage'
        ? client.rawFootageFolderId
        : client.essentialsFolderId;

    if (!folderPrefix) {
      return NextResponse.json(
        { error: `Missing S3 prefix for ${folderType}` },
        { status: 400 }
      );
    }

    // Generate unique key
    const key = `${folderPrefix}${Date.now()}-${fileName}`;
    
    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ContentType: fileType,
    });

    const response = await s3Client.send(command);

    return NextResponse.json({
      uploadId: response.UploadId,
      key,
      taskId,
      clientId,
      folderType,
    });
  } catch (error: any) {
    console.error('Error initiating upload:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload', message: error.message },
      { status: 500 }
    );
  }
}