export const dynamic = 'force-dynamic';
// src/app/api/hiring/test/[token]/route.ts
// Public (no login) — candidate-facing test task page reads/submits by token.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hiringCandidate, hiringTestTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rows = await db.select({
    task: hiringTestTask,
    candidate: { name: hiringCandidate.name },
  })
    .from(hiringTestTask)
    .innerJoin(hiringCandidate, eq(hiringTestTask.candidateId, hiringCandidate.id))
    .where(eq(hiringTestTask.submissionToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }
  const testTask = { ...row.task, candidate: row.candidate };

  const expired = testTask.expiresAt ? new Date(testTask.expiresAt).getTime() < Date.now() : false;

  return NextResponse.json({
    testTask: {
      id: testTask.id,
      title: testTask.title,
      instructions: testTask.instructions,
      rawFootageUrl: testTask.rawFootageUrl,
      status: testTask.status,
      submissionUrl: testTask.submissionUrl,
      submittedAt: testTask.submittedAt,
      candidateName: testTask.candidate.name,
      expired,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [testTask] = await db.select().from(hiringTestTask).where(eq(hiringTestTask.submissionToken, token)).limit(1);
  if (!testTask) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }
  if (testTask.expiresAt && new Date(testTask.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This link has expired. Reach out to E8 Productions for a new one.' }, { status: 410 });
  }
  if (testTask.status === 'SUBMITTED' || testTask.status === 'IN_REVIEW' || testTask.status === 'APPROVED' || testTask.status === 'REJECTED') {
    return NextResponse.json({ error: 'This test has already been submitted.' }, { status: 409 });
  }

  try {
    const body = await req.json();
    const { submissionUrl, submissionS3Key } = body;

    if (!submissionUrl && !submissionS3Key) {
      return NextResponse.json({ error: 'Provide a link or complete the upload first.' }, { status: 400 });
    }

    const [updated] = await db.update(hiringTestTask)
      .set({
        submissionUrl: submissionUrl || null,
        submissionS3Key: submissionS3Key || null,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hiringTestTask.submissionToken, token))
      .returning();

    await db.update(hiringCandidate)
      .set({ status: 'TEST_SUBMITTED', updatedAt: new Date().toISOString() })
      .where(eq(hiringCandidate.id, updated.candidateId));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Hiring] Submit test task error:', err.message);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
