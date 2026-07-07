export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { notifyQuoteAccepted, notifyQuoteRejected } from '@/lib/pipeline-notifications';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const quote = await prisma.quote.findUnique({
      where: { shareToken: token },
      include: {
        preClient: { select: { name: true, email: true, companyName: true, address: true } },
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
      // ── Document content fields ──
      preparedBy: quote.preparedBy ?? 'Gabe Rabinowitz + Eric Davis',
      inclusions: (quote.inclusions as string[]) ?? [],
      terms: (quote.terms as { title: string; body: string }[]) ?? [],
      acceptanceText: quote.acceptanceText ?? null,
    });
  } catch (err) {
    console.error('GET /api/quotes/[token] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** PATCH — admin inline edit. Requires active admin/manager session. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;
    const quote = await prisma.quote.findUnique({ where: { shareToken: token } });
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const body = await req.json();

    // Only allow patching document-content fields + services
    const allowedFields = ['preparedBy', 'inclusions', 'terms', 'acceptanceText', 'services', 'notes', 'totalAmount', 'validDays'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Recalculate totalAmount if services changed
    if (updateData.services && Array.isArray(updateData.services)) {
      updateData.totalAmount = (updateData.services as { total: number }[]).reduce(
        (sum, s) => sum + (s.total || 0),
        0
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, totalAmount: updated.totalAmount });
  } catch (err) {
    console.error('PATCH /api/quotes/[token] error:', err);
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
      const acceptedAmount = `$${(quote.totalAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      notifyQuoteAccepted(quote.preClient.name, acceptedAmount).catch((err) =>
        console.error('[quotes/[token]] notifyQuoteAccepted failed:', err)
      );
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
      notifyQuoteRejected(quote.preClient.name, rejectionReason || changeRequest).catch((err) =>
        console.error('[quotes/[token]] notifyQuoteRejected failed:', err)
      );
      return NextResponse.json({ success: true, action: 'rejected' });
    }
  } catch (err) {
    console.error('POST /api/quotes/[token] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}