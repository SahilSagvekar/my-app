export const dynamic = 'force-dynamic';
// app/api/upload/part-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3, BUCKET } from '@/lib/s3';

const s3Client = getS3();

const PRESIGNED_URL_EXPIRY = 86400;

export async function POST(request: NextRequest) {
  console.log("🚀 [DEBUG] Part-URL Request received at", new Date().toISOString());

  let body;
  try {
    const rawBody = await request.text();
    console.log("🚀 [DEBUG] Request raw body length:", rawBody.length);

    if (!rawBody || rawBody.trim() === '') {
      console.error("❌ [DEBUG] Empty request body received");
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    body = JSON.parse(rawBody);
    console.log("🚀 [DEBUG] Parsed body keys:", Object.keys(body));
  } catch (e: any) {
    console.error("❌ [DEBUG] JSON Parse Error:", e.message);
    return NextResponse.json({
      error: 'Invalid JSON body',
      details: e.message
    }, { status: 400 });
  }

  const { key, uploadId, partNumber } = body;

  try {
    if (!key || !uploadId || !partNumber) {
      console.error("❌ Missing required fields:", { key, uploadId, partNumber });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const command = new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    console.log(`✅ Presigned URL generated for part ${partNumber}`);
    return NextResponse.json({ presignedUrl });

  } catch (error: any) {
    console.error('❌ Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL', message: error.message },
      { status: 500 }
    );
  }
}