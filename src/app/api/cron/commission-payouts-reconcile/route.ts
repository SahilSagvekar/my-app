// src/app/api/cron/commission-payouts-reconcile/route.ts
// Safety net for the stripe-connect webhook: catches transfers whose
// transfer.created/transfer.reversed event never arrived (dropped delivery,
// endpoint downtime). Runs every 2 hours and directly asks Stripe for the
// current state of any payout still sitting in SENT.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const STUCK_AFTER_MINUTES = 30;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60 * 1000);

    const stuck = await prisma.commissionPayout.findMany({
      where: { status: 'SENT', sentAt: { lte: cutoff }, stripeTransferId: { not: null } },
    });

    let reconciledPaid = 0;
    let reconciledFailed = 0;

    for (const payout of stuck) {
      const transfer = await stripe.transfers.retrieve(payout.stripeTransferId!);
      const commissionId = transfer.metadata?.commissionId;
      if (!commissionId) continue;

      if (transfer.reversed) {
        await prisma.$transaction([
          prisma.commissionPayout.update({
            where: { id: payout.id },
            data: { status: 'FAILED', failedAt: new Date(), failureReason: 'Transfer reversed (reconciled)' },
          }),
          prisma.affiliateCommission.update({
            where: { id: commissionId },
            data: { status: 'FAILED' },
          }),
        ]);
        reconciledFailed++;
      } else {
        await prisma.$transaction([
          prisma.commissionPayout.update({
            where: { id: payout.id },
            data: { status: 'PAID', paidAt: new Date() },
          }),
          prisma.affiliateCommission.update({
            where: { id: commissionId },
            data: { status: 'PAID', paidAt: new Date() },
          }),
        ]);
        reconciledPaid++;
      }
    }

    // Orphan check: commissions stuck in PAYOUT_PENDING with no linked payout
    // at all means the process crashed between the atomic status flip and the
    // Stripe call — flag for manual review rather than auto-resolving.
    const orphaned = await prisma.affiliateCommission.count({
      where: { status: 'PAYOUT_PENDING', payoutId: null, updatedAt: { lte: cutoff } },
    });

    console.log(
      `[Payout Reconcile] checked ${stuck.length}, resolved ${reconciledPaid} paid / ${reconciledFailed} failed, ${orphaned} orphaned`
    );

    return NextResponse.json({
      message: 'Reconciliation completed',
      checked: stuck.length,
      reconciledPaid,
      reconciledFailed,
      orphanedCount: orphaned,
    });
  } catch (error: any) {
    console.error('[Payout Reconcile] Error:', error);
    return NextResponse.json({ error: 'Reconciliation failed', details: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
