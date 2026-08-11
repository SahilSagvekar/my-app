export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { preClient as preClientTable, quote as quoteTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const quotes = await db.select().from(quoteTable)
      .where(eq(quoteTable.preClientId, id))
      .orderBy(desc(quoteTable.version));
    return NextResponse.json(quotes);
  } catch (err) {
    console.error('GET quotes error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id: preClientId } = await params;
    const [preClient] = await db.select().from(preClientTable).where(eq(preClientTable.id, preClientId)).limit(1);
    if (!preClient) return NextResponse.json({ error: 'Pre-client not found' }, { status: 404 });

    const body = await req.json();
    const { services, notes, validDays, preparedBy, inclusions, terms, acceptanceText, address } = body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: 'At least one service line item is required' }, { status: 400 });
    }

    const totalAmount = services.reduce((sum: number, s: any) => sum + (s.total || 0), 0);

    const [latest] = await db.select({ version: quoteTable.version }).from(quoteTable)
      .where(eq(quoteTable.preClientId, preClientId))
      .orderBy(desc(quoteTable.version))
      .limit(1);

    const version = (latest?.version ?? 0) + 1;

    const [quote] = await db.insert(quoteTable).values({
      id: createId(),
      preClientId,
      version,
      services,
      totalAmount,
      notes: notes || null,
      validDays: validDays || 30,
      status: 'DRAFT',
      preparedBy: preparedBy || null,
      inclusions: inclusions || [],
      terms: terms || [],
      acceptanceText: acceptanceText || null,
      shareToken: createId(),
      updatedAt: new Date().toISOString(),
    }).returning();

    if (['QUALIFIED'].includes(preClient.status) || address !== undefined) {
      await db.update(preClientTable).set({
        ...(['QUALIFIED'].includes(preClient.status) ? { status: 'QUOTED' as const } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
        updatedAt: new Date().toISOString(),
      }).where(eq(preClientTable.id, preClientId));
    }

    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    console.error('POST quote error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
