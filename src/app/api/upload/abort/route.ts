export const dynamic = 'force-dynamic';
// app/api/upload/abort/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';

const s3Client = getS3();

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
      Bucket: BUCKET,
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