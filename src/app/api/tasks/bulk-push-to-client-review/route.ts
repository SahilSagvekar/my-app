export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const body = await request.json();
    const { taskIds } = body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Task IDs array is required' }, { status: 400 });
    }

    // Only already-approved (COMPLETED) tasks are eligible — this pushes
    // an already-QC'd video into client review after the fact.
    const eligible = await prisma.task.findMany({
      where: { id: { in: taskIds }, status: 'COMPLETED' },
      select: { id: true },
    });

    if (eligible.length === 0) {
      return NextResponse.json(
        { success: false, error: 'None of the selected tasks are eligible (must be Approved)' },
        { status: 400 }
      );
    }

    // Reuse the single-task status endpoint per task — it already owns all
    // the correct side effects (notify client, mirror video to YouTube/Drive,
    // titling trigger, audit log) so we don't duplicate that logic here.
    const origin = request.nextUrl.origin;
    const results = await Promise.allSettled(
      eligible.map((task) =>
        fetch(`${origin}/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ status: 'CLIENT_REVIEW', forceClientReview: true }),
        }).then((res) => {
          if (!res.ok) throw new Error(`Task ${task.id} failed: ${res.status}`);
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      success: true,
      count: succeeded,
      skipped: taskIds.length - eligible.length,
      failed,
      message: `${succeeded} task(s) pushed to client review${failed ? `, ${failed} failed` : ''}`,
    });
  } catch (error) {
    console.error('[BULK PUSH TO CLIENT REVIEW] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to push tasks to client review' }, { status: 500 });
  }
}