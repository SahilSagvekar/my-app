export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const quote = await prisma.quote.findUnique({
      where: { shareToken: token },
      include: {
        preClient: { select: { name: true, email: true, companyName: true } },
      },
    });

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    if (!quote.viewedAt && quote.status === 'SENT') {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'VIEWED', viewedAt: new Date() },
      });
    }

    return NextResponse.json({
      id: quote.id,
      version: quote.version,
      status: quote.status === 'SENT' ? 'VIEWED' : quote.status,
      services: quote.services,
      totalAmount: quote.totalAmount,
      notes: quote.notes,
      validDays: quote.validDays,
      createdAt: quote.createdAt,
      sentAt: quote.sentAt,
      preClient: quote.preClient,
    });
  } catch (err) {
    console.error('GET /api/quotes/[token] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { action, rejectionReason, changeRequest } = body;

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const quote = await prisma.quote.findUnique({
      where: { shareToken: token },
      include: { preClient: true },
    });

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    if (['ACCEPTED', 'REJECTED'].includes(quote.status)) {
      return NextResponse.json(
        { error: `Quote has already been ${quote.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (action === 'accept') {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await prisma.preClient.update({
        where: { id: quote.preClientId },
        data: { status: 'QUOTE_ACCEPTED' },
      });
      return NextResponse.json({ success: true, action: 'accepted' });
    }

    if (action === 'reject') {
      if (!rejectionReason && !changeRequest) {
        return NextResponse.json(
          { error: 'Please provide a reason or describe the changes you need' },
          { status: 400 }
        );
      }
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: rejectionReason || null,
          changeRequest: changeRequest || null,
        },
      });
      await prisma.preClient.update({
        where: { id: quote.preClientId },
        data: { status: 'QUOTED' },
      });
      return NextResponse.json({ success: true, action: 'rejected' });
    }
  } catch (err) {
    console.error('POST /api/quotes/[token] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}