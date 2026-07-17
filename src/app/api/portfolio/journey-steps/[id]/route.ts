export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// PATCH /api/portfolio/journey-steps/[id] — admin: edit caption/order/image for a step.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const { id } = await params;
        const body = await req.json();

        const step = await prisma.portfolioJourneyStep.findUnique({ where: { id } });
        if (!step) {
            return NextResponse.json({ ok: false, message: 'Step not found' }, { status: 404 });
        }

        const updated = await prisma.portfolioJourneyStep.update({
            where: { id },
            data: {
                ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
                ...(body.caption !== undefined && { caption: body.caption }),
                ...(body.order !== undefined && { order: body.order }),
            },
        });

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
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const { id } = await params;

        const step = await prisma.portfolioJourneyStep.findUnique({ where: { id } });
        if (!step) {
            return NextResponse.json({ ok: false, message: 'Step not found' }, { status: 404 });
        }

        await prisma.portfolioJourneyStep.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/journey-steps/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
