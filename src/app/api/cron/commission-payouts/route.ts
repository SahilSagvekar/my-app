// src/app/api/cron/commission-payouts/route.ts
// Weekly batch payout run: fires Stripe transfers for every APPROVED commission
// past its hold window and above the configured minimum threshold. Commissions
// below threshold are left APPROVED and roll into next week's run.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { affiliateCommission, payoutBatchRun } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getPayoutConfig } from '@/lib/payout-config';
import { sendCommissionTransfer, PayoutError } from '@/lib/stripe-payouts';

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { minimumThresholdCents } = await getPayoutConfig();
    const minimumDollars = minimumThresholdCents / 100;
    const now = new Date();

    const eligible = await db.query.affiliateCommission.findMany({
      where: and(
        eq(affiliateCommission.status, 'APPROVED'),
        lte(affiliateCommission.holdUntil, now.toISOString()),
        gte(affiliateCommission.commissionAmt, String(minimumDollars)),
      ),
      with: { user: { with: { salesRepPayoutProfiles: true } } },
    });

    if (eligible.length === 0) {
      return NextResponse.json({ message: 'No eligible commissions this run', total: 0 });
    }

    const [batch] = await db.insert(payoutBatchRun).values({
      id: createId(),
      status: 'RUNNING',
      totalPayouts: eligible.length,
    }).returning();

    const results: { commissionId: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }[] = [];
    let totalAmount = 0;

    for (const commission of eligible) {
      // salesRepPayoutProfile has a unique userId FK (1:1), but drizzle-kit
      // introspection mislabels it many() — take the first (only) entry.
      if (!commission.user.salesRepPayoutProfiles[0]?.payoutsEnabled) {
        results.push({ commissionId: commission.id, status: 'skipped', reason: 'rep not onboarded' });
        continue;
      }
      try {
        await sendCommissionTransfer(commission.id, batch.id);
        totalAmount += Number(commission.commissionAmt);
        results.push({ commissionId: commission.id, status: 'sent' });
      } catch (err: any) {
        const reason = err instanceof PayoutError ? err.code : err.message;
        results.push({ commissionId: commission.id, status: 'failed', reason });
      }
    }

    await db.update(payoutBatchRun).set({
      status: 'COMPLETED',
      totalAmount: String(totalAmount),
      completedAt: new Date().toISOString(),
    }).where(eq(payoutBatchRun.id, batch.id));

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    console.log(`[Commission Payout Batch] ${batch.id}: ${sent} sent, ${failed} failed, ${skipped} skipped`);

    return NextResponse.json({
      message: 'Batch run completed',
      batchId: batch.id,
      total: eligible.length,
      sent,
      failed,
      skipped,
      results,
    });
  } catch (error: any) {
    console.error('[Commission Payout Batch] Error:', error);
    return NextResponse.json({ error: 'Batch run failed', details: error.message }, { status: 500 });
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
