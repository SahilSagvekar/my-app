export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { portfolioJourneyClient, portfolioJourneyStep } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// POST /api/portfolio/journey-clients/[id]/steps — admin: add a step to a client.
export async function POST(
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

        const { id: clientId } = await params;
        const body = await req.json();
        const { imageUrl, caption, order } = body;

        if (!imageUrl || !caption) {
            return NextResponse.json({ ok: false, message: 'imageUrl and caption are required' }, { status: 400 });
        }

        const [client] = await db.select().from(portfolioJourneyClient).where(eq(portfolioJourneyClient.id, clientId)).limit(1);
        if (!client) {
            return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
        }

        const [step] = await db.insert(portfolioJourneyStep).values({
            id: createId(),
            clientId,
            imageUrl,
            caption,
            order: order ?? 0,
            updatedAt: new Date().toISOString(),
        }).returning();

        return NextResponse.json({ ok: true, step });
    } catch (err) {
        console.error('[POST /api/portfolio/journey-clients/[id]/steps]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
