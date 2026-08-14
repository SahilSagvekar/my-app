export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioJourneyStep } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// PATCH /api/portfolio/journey-steps/[id] — admin: edit caption/order/image for a step.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const { id } = await params;
        const body = await req.json();

        const [step] = await db.select().from(portfolioJourneyStep).where(eq(portfolioJourneyStep.id, id)).limit(1);
        if (!step) {
            return NextResponse.json({ ok: false, message: 'Step not found' }, { status: 404 });
        }

        const [updated] = await db.update(portfolioJourneyStep).set({
            ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
            ...(body.caption !== undefined && { caption: body.caption }),
            ...(body.order !== undefined && { order: body.order }),
            updatedAt: new Date().toISOString(),
        }).where(eq(portfolioJourneyStep.id, id)).returning();

        return NextResponse.json({ ok: true, step: updated });
    } catch (err) {
        console.error('[PATCH /api/portfolio/journey-steps/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// DELETE /api/portfolio/journey-steps/[id] — admin: delete a step.
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const { id } = await params;

        const [step] = await db.select().from(portfolioJourneyStep).where(eq(portfolioJourneyStep.id, id)).limit(1);
        if (!step) {
            return NextResponse.json({ ok: false, message: 'Step not found' }, { status: 404 });
        }

        await db.delete(portfolioJourneyStep).where(eq(portfolioJourneyStep.id, id));

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/journey-steps/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
