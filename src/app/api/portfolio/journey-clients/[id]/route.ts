export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// PATCH /api/portfolio/journey-clients/[id] — admin: update fields, reorder, toggle active.
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

        const client = await prisma.portfolioJourneyClient.findUnique({ where: { id } });
        if (!client) {
            return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
        }

        const updated = await prisma.portfolioJourneyClient.update({
            where: { id },
            data: {
                ...(body.label !== undefined && { label: body.label }),
                ...(body.sublabel !== undefined && { sublabel: body.sublabel }),
                ...(body.iconKey !== undefined && { iconKey: body.iconKey }),
                ...(body.order !== undefined && { order: body.order }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
            include: { steps: { orderBy: { order: 'asc' } } },
        });

        return NextResponse.json({ ok: true, client: updated });
    } catch (err) {
        console.error('[PATCH /api/portfolio/journey-clients/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// DELETE /api/portfolio/journey-clients/[id] — admin: delete client (cascades its steps).
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

        const client = await prisma.portfolioJourneyClient.findUnique({ where: { id } });
        if (!client) {
            return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
        }

        await prisma.portfolioJourneyClient.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/journey-clients/[id]]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
