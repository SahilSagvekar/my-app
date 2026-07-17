export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

// GET /api/nas/mirror-jobs/:id — polled by the admin UI every few seconds
// while a job is running to show live progress.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const job = await prisma.nasMirrorJob.findUnique({ where: { id: params.id } });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    return NextResponse.json({ job });
  } catch (err: any) {
    console.error('[NAS Mirror Job GET]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}