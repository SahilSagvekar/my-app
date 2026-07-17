export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// GET /api/portfolio/journey-clients — public: active clients + active steps, ordered.
// ?all=true (admin) — everything including inactive, for the admin management UI.
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const showAll = searchParams.get('all') === 'true';

        if (showAll) {
            const user = getUserFromToken(req);
            const authError = requireAdmin(user);
            if (authError) {
                return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
            }
        }

        const clients = await prisma.portfolioJourneyClient.findMany({
            where: showAll ? {} : { isActive: true },
            orderBy: { order: 'asc' },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return NextResponse.json({ ok: true, clients });
    } catch (err) {
        console.error('[GET /api/portfolio/journey-clients]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// POST /api/portfolio/journey-clients — admin: create a new journey client.
export async function POST(req: NextRequest) {
    try {
        const user = getUserFromToken(req);
        const authError = requireAdmin(user);
        if (authError) {
            return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
        }

        const body = await req.json();
        const { label, sublabel, iconKey, order } = body;

        if (!label) {
            return NextResponse.json({ ok: false, message: 'Label is required' }, { status: 400 });
        }

        const client = await prisma.portfolioJourneyClient.create({
            data: {
                label,
                sublabel: sublabel || null,
                iconKey: iconKey || null,
                order: order ?? 0,
            },
            include: { steps: true },
        });

        return NextResponse.json({ ok: true, client });
    } catch (err) {
        console.error('[POST /api/portfolio/journey-clients]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
