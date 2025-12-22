// app/api/upload/abort/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { key, uploadId } = await request.json();

    if (!key || !uploadId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      UploadId: uploadId,
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error aborting upload:', error);
    return NextResponse.json(
      { error: 'Failed to abort upload', message: error.message },
      { status: 500 }
    );
  }
}