// src/app/api/cron/commission-payouts-reconcile/route.ts
// Safety net for the stripe-connect webhook: catches transfers whose
// transfer.created/transfer.reversed event never arrived (dropped delivery,
// endpoint downtime). Runs every 2 hours and directly asks Stripe for the
// current state of any payout still sitting in SENT.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { commissionPayout, affiliateCommission } from '@/lib/db/schema';
import { and, eq, isNull, isNotNull, lte, count as countFn } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

const STUCK_AFTER_MINUTES = 30;

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    const stuck = await db.select().from(commissionPayout).where(and(
      eq(commissionPayout.status, 'SENT'),
      lte(commissionPayout.sentAt, cutoffIso),
      isNotNull(commissionPayout.stripeTransferId),
    ));

    let reconciledPaid = 0;
    let reconciledFailed = 0;

    for (const payout of stuck) {
      const transfer = await stripe.transfers.retrieve(payout.stripeTransferId!);
      const commissionId = transfer.metadata?.commissionId;
      if (!commissionId) continue;

      const now = new Date().toISOString();
      if (transfer.reversed) {
        await db.batch([
          db.update(commissionPayout).set({
            status: 'FAILED', failedAt: now, failureReason: 'Transfer reversed (reconciled)', updatedAt: now,
          }).where(eq(commissionPayout.id, payout.id)),
          db.update(affiliateCommission).set({
            status: 'FAILED', updatedAt: now,
          }).where(eq(affiliateCommission.id, commissionId)),
        ] as any);
        reconciledFailed++;
      } else {
        await db.batch([
          db.update(commissionPayout).set({
            status: 'PAID', paidAt: now, updatedAt: now,
          }).where(eq(commissionPayout.id, payout.id)),
          db.update(affiliateCommission).set({
            status: 'PAID', paidAt: now, updatedAt: now,
          }).where(eq(affiliateCommission.id, commissionId)),
        ] as any);
        reconciledPaid++;
      }
    }

    // Orphan check: commissions stuck in PAYOUT_PENDING with no linked payout
    // at all means the process crashed between the atomic status flip and the
    // Stripe call — flag for manual review rather than auto-resolving.
    const [{ value: orphaned }] = await db.select({ value: countFn() }).from(affiliateCommission).where(and(
      eq(affiliateCommission.status, 'PAYOUT_PENDING'),
      isNull(affiliateCommission.payoutId),
      lte(affiliateCommission.updatedAt, cutoffIso),
    ));

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

  } finally {
    await closeDb();
  }
}

export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  return POST(req);

  } finally {
    await closeDb();
  }
}
