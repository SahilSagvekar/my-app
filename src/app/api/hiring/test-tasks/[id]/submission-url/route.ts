export const dynamic = 'force-dynamic';
// src/app/api/hiring/test-tasks/[id]/submission-url/route.ts
// Admin-only — presigned view URL for a directly-uploaded test submission.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { hiringTestTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { generateSignedUrl } from '@/lib/s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [testTask] = await db.select().from(hiringTestTask).where(eq(hiringTestTask.id, id)).limit(1);
  if (!testTask?.submissionS3Key) {
    return NextResponse.json({ error: 'No uploaded submission for this task' }, { status: 404 });
  }

  const url = await generateSignedUrl(testTask.submissionS3Key, 3600);
  return NextResponse.json({ url });
}
