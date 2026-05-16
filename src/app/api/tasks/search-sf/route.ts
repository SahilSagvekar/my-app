export const dynamic = 'force-dynamic';
// src/app/api/tasks/search-sf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') ?? '';
    const clientId = searchParams.get('clientId') ?? undefined;
    const excludeLfId = searchParams.get('excludeLfId') ?? undefined;

    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          clientId ? { clientId } : {},
          excludeLfId ? { id: { not: excludeLfId } } : {},
          {
            OR: [
              { deliverableType: { contains: 'SF', mode: 'insensitive' } },
              { deliverableType: { contains: 'SHORT', mode: 'insensitive' } },
              { taskType: { contains: 'SF', mode: 'insensitive' } },
            ],
          },
          query.length > 1
            ? {
                OR: [
                  { title: { contains: query, mode: 'insensitive' } },
                  { description: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        deliverableType: true,
        status: true,
        relatedTaskId: true,
        client: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ tasks });
  } catch (err: any) {
    console.error('[search-sf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}