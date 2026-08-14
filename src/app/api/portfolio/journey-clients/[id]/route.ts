export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { portfolioJourneyClient } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// PATCH /api/portfolio/journey-clients/[id] — admin: update fields, reorder, toggle active.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const { id } = await params;
        const body = await req.json();

        const [client] = await db.select().from(portfolioJourneyClient).where(eq(portfolioJourneyClient.id, id)).limit(1);
        if (!client) {
            return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
        }

        const [updatedClient] = await db.update(portfolioJourneyClient).set({
            ...(body.label !== undefined && { label: body.label }),
            ...(body.sublabel !== undefined && { sublabel: body.sublabel }),
            ...(body.iconKey !== undefined && { iconKey: body.iconKey }),
            ...(body.order !== undefined && { order: body.order }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
            updatedAt: new Date().toISOString(),
        }).where(eq(portfolioJourneyClient.id, id)).returning();

        const steps = await db.query.portfolioJourneyStep.findMany({
            where: (s, { eq }) => eq(s.clientId, id),
            orderBy: (s, { asc }) => [asc(s.order)],
        });

        const updated = { ...updatedClient, steps };

        return NextResponse.json({ ok: true, client: updated });
    } catch (err) {
        console.error('[PATCH /api/portfolio/journey-clients/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}

// DELETE /api/portfolio/journey-clients/[id] — admin: delete client (cascades its steps).
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const { id } = await params;

        const [client] = await db.select().from(portfolioJourneyClient).where(eq(portfolioJourneyClient.id, id)).limit(1);
        if (!client) {
            return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
        }

        await db.delete(portfolioJourneyClient).where(eq(portfolioJourneyClient.id, id));

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/journey-clients/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
