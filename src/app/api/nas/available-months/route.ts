export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

const FINALIZED_STATUSES = ['COMPLETED', 'SCHEDULED', 'POSTED'] as const;

// GET /api/nas/available-months?clientName=... — distinct month folders
// with finalized output files for that client, most recent first.
// Used to populate the month dropdown in the NAS Backup admin panel.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const clientName = req.nextUrl.searchParams.get('clientName');
    if (!clientName) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        status: { in: FINALIZED_STATUSES as any },
        monthFolder: { not: null },
        client: { OR: [{ companyName: clientName }, { name: clientName }] },
      },
      select: { monthFolder: true },
      distinct: ['monthFolder'],
    });

    const months = tasks
      .map(t => t.monthFolder!)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime() || b.localeCompare(a));

    return NextResponse.json({ months });
  } catch (err: any) {
    console.error('[NAS Available Months]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}