export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/link-sf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: lfTaskId } = await params;

    const linked = await prisma.task.findMany({
      where: { relatedTaskId: lfTaskId },
      select: {
        id: true,
        title: true,
        description: true,
        deliverableType: true,
        status: true,
        dueDate: true,
        assignedTo: true,
        clientId: true,
        client: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ linked });
  } catch (err: any) {
    console.error('[link-sf GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: lfTaskId } = await params;
    const { sfTaskId } = await req.json();

    if (!sfTaskId) return NextResponse.json({ error: 'sfTaskId is required' }, { status: 400 });

    const lfTask = await prisma.task.findUnique({ where: { id: lfTaskId }, select: { id: true } });
    if (!lfTask) return NextResponse.json({ error: 'LF task not found' }, { status: 404 });

    if (sfTaskId === lfTaskId) return NextResponse.json({ error: 'Cannot link a task to itself' }, { status: 400 });

    const sfTask = await prisma.task.findUnique({ where: { id: sfTaskId }, select: { id: true } });
    if (!sfTask) return NextResponse.json({ error: 'SF task not found' }, { status: 404 });

    await prisma.task.update({
      where: { id: sfTaskId },
      data: { relatedTaskId: lfTaskId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[link-sf POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: lfTaskId } = await params;
    const { sfTaskId } = await req.json();

    if (!sfTaskId) return NextResponse.json({ error: 'sfTaskId is required' }, { status: 400 });

    await prisma.task.updateMany({
      where: { id: sfTaskId, relatedTaskId: lfTaskId },
      data: { relatedTaskId: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[link-sf DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}