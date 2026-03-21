import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileIds } = await req.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'fileIds array required' }, { status: 400 });
    }

    // Limit batch size to prevent abuse
    const limitedIds = fileIds.slice(0, 50);

    // Fetch files from database
    const files = await prisma.file.findMany({
      where: {
        id: { in: limitedIds },
        s3Key: { not: null },
      },
      select: {
        id: true,
        s3Key: true,
        mimeType: true,
      },
    });

    const s3Client = getS3();
    const urls: Record<string, string> = {};

    // Generate presigned URLs in parallel
    await Promise.all(
      files.map(async (file) => {
        if (!file.s3Key) return;

        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: file.s3Key,
          });

          // Presigned URL valid for 1 hour
          const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
          urls[file.id] = presignedUrl;
        } catch (err) {
          console.error(`Failed to presign URL for file ${file.id}:`, err);
        }
      })
    );

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('Batch presign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
