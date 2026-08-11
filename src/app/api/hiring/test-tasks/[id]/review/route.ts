export const dynamic = 'force-dynamic';
// src/app/api/hiring/test-tasks/[id]/review/route.ts
// Admin approves or rejects a submitted test task and notifies the candidate.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hiringCandidate, hiringTestTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { sendTestTaskDecisionEmail } from '@/lib/hiring-email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { decision, reviewNotes } = body;

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return NextResponse.json({ error: 'decision must be APPROVED or REJECTED' }, { status: 400 });
    }

    const [updatedTask] = await db.update(hiringTestTask)
      .set({
        status: decision,
        reviewNotes: reviewNotes || null,
        reviewedById: user.id,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hiringTestTask.id, id))
      .returning();

    const [candidateRow] = await db.select().from(hiringCandidate).where(eq(hiringCandidate.id, updatedTask.candidateId)).limit(1);
    const testTask = { ...updatedTask, candidate: candidateRow };

    await db.update(hiringCandidate)
      .set({ status: decision === 'APPROVED' ? 'HIRED' : 'REJECTED', updatedAt: new Date().toISOString() })
      .where(eq(hiringCandidate.id, updatedTask.candidateId));

    const emailResult = await sendTestTaskDecisionEmail({
      candidateName: testTask.candidate.name,
      candidateEmail: testTask.candidate.email,
      taskTitle: testTask.title,
      decision,
      reviewNotes,
    });

    return NextResponse.json({ ok: true, testTask, email: emailResult });
  } catch (err: any) {
    console.error('[Hiring] Review test task error:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to review test task' }, { status: 500 });
  }
}
