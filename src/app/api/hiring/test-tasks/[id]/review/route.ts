export const dynamic = 'force-dynamic';
// src/app/api/hiring/test-tasks/[id]/review/route.ts
// Admin approves or rejects a submitted test task and notifies the candidate.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const testTask = await prisma.hiringTestTask.update({
      where: { id },
      data: {
        status: decision,
        reviewNotes: reviewNotes || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: { candidate: true },
    });

    await prisma.hiringCandidate.update({
      where: { id: testTask.candidateId },
      data: { status: decision === 'APPROVED' ? 'HIRED' : 'REJECTED' },
    });

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
