export const dynamic = 'force-dynamic';
// src/app/api/hiring/test/[token]/upload-url/route.ts
// Public (no login) — returns a presigned PUT URL so the candidate can
// upload their test edit directly to R2/S3 from the browser.

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3, BUCKET } from '@/lib/s3';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const testTask = await prisma.hiringTestTask.findUnique({ where: { submissionToken: token } });
  if (!testTask) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  if (testTask.expiresAt && testTask.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  try {
    const body = await req.json();
    const fileName: string = body.fileName || 'submission.mp4';
    const contentType: string = body.contentType || 'video/mp4';

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `hiring-submissions/${testTask.candidateId}/${testTask.id}/${Date.now()}-${safeName}`;

    const s3 = getS3();
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 900 }
    );

    return NextResponse.json({ uploadUrl, s3Key: key });
  } catch (err: any) {
    console.error('[Hiring] Presign upload error:', err.message);
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }
}
