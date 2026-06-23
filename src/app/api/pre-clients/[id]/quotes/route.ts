export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const quotes = await prisma.quote.findMany({
      where: { preClientId: id },
      orderBy: { version: 'desc' },
    });
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
    const preClient = await prisma.preClient.findUnique({ where: { id: preClientId } });
    if (!preClient) return NextResponse.json({ error: 'Pre-client not found' }, { status: 404 });

    const body = await req.json();
    const { services, notes, validDays } = body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: 'At least one service line item is required' }, { status: 400 });
    }

    const totalAmount = services.reduce((sum: number, s: any) => sum + (s.total || 0), 0);

    const latest = await prisma.quote.findFirst({
      where: { preClientId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const version = (latest?.version ?? 0) + 1;

    const quote = await prisma.quote.create({
      data: {
        preClientId,
        version,
        services,
        totalAmount,
        notes: notes || null,
        validDays: validDays || 30,
        status: 'DRAFT',
      },
    });

    if (['QUALIFIED'].includes(preClient.status)) {
      await prisma.preClient.update({
        where: { id: preClientId },
        data: { status: 'QUOTED' },
      });
    }

    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    console.error('POST quote error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}