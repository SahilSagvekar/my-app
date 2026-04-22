export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';

// GET - Fetch all posting targets (optionally by clientId)
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    const where: any = {};
    if (clientId) where.clientId = clientId;

    const targets = await prisma.postingTarget.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, companyName: true } },
      },
      orderBy: [{ clientId: 'asc' }, { platform: 'asc' }, { deliverableType: 'asc' }],
    });

    return NextResponse.json({ ok: true, targets });
  } catch (error) {
    console.error('Error fetching posting targets:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update posting targets for a client (bulk upsert)
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only admin/manager/scheduler can manage targets
    if (!['ADMIN', 'MANAGER', 'SCHEDULER'].includes(currentUser.role?.toUpperCase())) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, targets } = body;

    if (!clientId || !Array.isArray(targets)) {
      return NextResponse.json(
        { ok: false, message: 'clientId and targets array required' },
        { status: 400 }
      );
    }

    // Validate each target
    for (const t of targets) {
      if (!t.platform || !t.deliverableType || typeof t.count !== 'number') {
        return NextResponse.json(
          { ok: false, message: 'Each target needs platform, deliverableType, count' },
          { status: 400 }
        );
      }
    }

    // Delete existing targets for this client then recreate (simpler than individual upserts)
    await prisma.$transaction(async (tx) => {
      await tx.postingTarget.deleteMany({ where: { clientId } });

      if (targets.length > 0) {
        await tx.postingTarget.createMany({
          data: targets.map((t: any) => ({
            clientId,
            platform: t.platform,
            deliverableType: t.deliverableType,
            count: t.count,
            frequency: t.frequency || 'daily',
            extras: t.extras || null,
          })),
        });
      }
    });

    // Fetch the created targets
    const created = await prisma.postingTarget.findMany({
      where: { clientId },
      orderBy: [{ platform: 'asc' }, { deliverableType: 'asc' }],
    });

    return NextResponse.json({ ok: true, targets: created });
  } catch (error) {
    console.error('Error saving posting targets:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }
}