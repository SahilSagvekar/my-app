export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { createNasMirrorJob } from '@/lib/nas-mirror-queue';

// POST /api/nas/mirror-jobs — create a new mirror job (client + month).
// The job is inserted with status "pending" and picked up by
// nas-mirror-worker.ts on cron-master's next tick — this route returns
// immediately, it does not wait for the copy to happen.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { clientName, monthFolder } = await req.json();
    if (!clientName || !monthFolder) {
      return NextResponse.json({ error: 'clientName and monthFolder are required' }, { status: 400 });
    }

    // Avoid queuing a duplicate if one's already pending/running for the same client+month.
    const existing = await prisma.nasMirrorJob.findFirst({
      where: { clientName, monthFolder, status: { in: ['pending', 'running'] } },
    });
    if (existing) {
      return NextResponse.json({ job: existing, alreadyQueued: true });
    }

    const job = await createNasMirrorJob(clientName, monthFolder, user.id);
    return NextResponse.json({ job, alreadyQueued: false });
  } catch (err: any) {
    console.error('[NAS Mirror Jobs POST]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET /api/nas/mirror-jobs — recent job history, most recent first.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const jobs = await prisma.nasMirrorJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { TriggeredBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ jobs });
  } catch (err: any) {
    console.error('[NAS Mirror Jobs GET]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}