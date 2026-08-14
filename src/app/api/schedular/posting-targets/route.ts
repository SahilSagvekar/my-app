export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { postingTarget } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, asc } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth-helpers';

// GET - Fetch all posting targets (optionally by clientId)
export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    const targets = await db.query.postingTarget.findMany({
      where: clientId ? eq(postingTarget.clientId, clientId) : undefined,
      with: {
        client: { columns: { id: true, name: true, companyName: true } },
      },
      orderBy: [asc(postingTarget.clientId), asc(postingTarget.platform), asc(postingTarget.deliverableType)],
    });

    return NextResponse.json({ ok: true, targets });
  } catch (error) {
    console.error('Error fetching posting targets:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// POST - Create or update posting targets for a client (bulk upsert)
export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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
    await db.transaction(async (tx) => {
      await tx.delete(postingTarget).where(eq(postingTarget.clientId, clientId));

      if (targets.length > 0) {
        await tx.insert(postingTarget).values(
          targets.map((t: any) => ({
            id: createId(),
            clientId,
            platform: t.platform,
            deliverableType: t.deliverableType,
            count: t.count,
            frequency: t.frequency || 'daily',
            extras: t.extras || null,
            updatedAt: new Date().toISOString(),
          }))
        );
      }
    });

    // Fetch the created targets
    const created = await db.select().from(postingTarget)
      .where(eq(postingTarget.clientId, clientId))
      .orderBy(asc(postingTarget.platform), asc(postingTarget.deliverableType));

    return NextResponse.json({ ok: true, targets: created });
  } catch (error) {
    console.error('Error saving posting targets:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}