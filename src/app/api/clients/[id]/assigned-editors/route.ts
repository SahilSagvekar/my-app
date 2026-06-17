export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/assigned-editors/route.ts
//
// Returns the editors currently assigned to active tasks for a client.
// Used by the raw footage upload dialog so admin can pick exactly who
// gets tagged in the Slack notification — instead of always tagging
// every editor with an open task for that client.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admin/manager need this — editors/clients don't tag people on upload
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: clientId } = await params;

    const editors = await prisma.user.findMany({
      where: {
        role: 'editor',
        assignedTasks: {
          some: {
            clientId,
            status: { notIn: ['COMPLETED', 'POSTED'] },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        slackUserId: true,
      },
      distinct: ['id'],
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ editors });
  } catch (err: any) {
    console.error('[assigned-editors GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
