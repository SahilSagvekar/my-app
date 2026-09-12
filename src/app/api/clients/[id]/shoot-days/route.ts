export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/shoot-days/route.ts
// Update Client.shootDaysPerMonth — tracking-only quota that also drives
// the generate-monthly-shoots cron (see /api/cron/generate-monthly-shoots).

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const { id: clientId } = await params;
    const body = await request.json();
    const { shootDaysPerMonth } = body;

    if (typeof shootDaysPerMonth !== 'number' || !Number.isFinite(shootDaysPerMonth)) {
      return NextResponse.json(
        { error: 'shootDaysPerMonth must be a number' },
        { status: 400 }
      );
    }

    const clamped = Math.max(0, Math.min(99, Math.round(shootDaysPerMonth)));

    const [updatedClient] = await db.update(client).set({
      shootDaysPerMonth: clamped,
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, clientId)).returning();

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client: updatedClient });
  } catch (error: unknown) {
    console.error('[Client Shoot Days] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update shoot days' }, { status: 500 });
  }
}
