export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioJourneyClient } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, asc } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// GET /api/portfolio/journey-clients — public: active clients + active steps, ordered.
// ?all=true (admin) — everything including inactive, for the admin management UI.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
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

        const clients = await db.query.portfolioJourneyClient.findMany({
            where: showAll ? undefined : eq(portfolioJourneyClient.isActive, true),
            orderBy: [asc(portfolioJourneyClient.order), asc(portfolioJourneyClient.createdAt)],
            with: {
                portfolioJourneySteps: {
                    orderBy: (steps, { asc }) => [asc(steps.order), asc(steps.createdAt)],
                },
            },
        });

        const clientsWithSteps = clients.map(({ portfolioJourneySteps, ...c }) => ({ ...c, steps: portfolioJourneySteps }));

        return NextResponse.json({ ok: true, clients: clientsWithSteps });
    } catch (err) {
        console.error('[GET /api/portfolio/journey-clients]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// POST /api/portfolio/journey-clients — admin: create a new journey client.
export async function POST(req: NextRequest) {
  const db = getDbHttp();
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

        const [created] = await db.insert(portfolioJourneyClient).values({
            id: createId(),
            label,
            sublabel: sublabel || null,
            iconKey: iconKey || null,
            order: order ?? 0,
            updatedAt: new Date().toISOString(),
        }).returning();

        const client = { ...created, steps: [] as any[] };

        return NextResponse.json({ ok: true, client });
    } catch (err) {
        console.error('[POST /api/portfolio/journey-clients]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
