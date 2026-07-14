export const dynamic = 'force-dynamic';
// src/app/api/hiring/test-tasks/[id]/submission-url/route.ts
// Admin-only — presigned view URL for a directly-uploaded test submission.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { generateSignedUrl } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const testTask = await prisma.hiringTestTask.findUnique({ where: { id } });
  if (!testTask?.submissionS3Key) {
    return NextResponse.json({ error: 'No uploaded submission for this task' }, { status: 404 });
  }

  const url = await generateSignedUrl(testTask.submissionS3Key, 3600);
  return NextResponse.json({ url });
}
