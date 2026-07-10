// src/app/api/cron/commission-payouts/route.ts
// Weekly batch payout run: fires Stripe transfers for every APPROVED commission
// past its hold window and above the configured minimum threshold. Commissions
// below threshold are left APPROVED and roll into next week's run.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayoutConfig } from '@/lib/payout-config';
import { sendCommissionTransfer, PayoutError } from '@/lib/stripe-payouts';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { minimumThresholdCents } = await getPayoutConfig();
    const minimumDollars = minimumThresholdCents / 100;
    const now = new Date();

    const eligible = await prisma.affiliateCommission.findMany({
      where: {
        status: 'APPROVED',
        holdUntil: { lte: now },
        commissionAmt: { gte: minimumDollars },
      },
      include: { user: { include: { payoutProfile: true } } },
    });

    if (eligible.length === 0) {
      return NextResponse.json({ message: 'No eligible commissions this run', total: 0 });
    }

    const batch = await prisma.payoutBatchRun.create({
      data: { status: 'RUNNING', totalPayouts: eligible.length },
    });

    const results: { commissionId: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }[] = [];
    let totalAmount = 0;

    for (const commission of eligible) {
      if (!commission.user.payoutProfile?.payoutsEnabled) {
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

    await prisma.payoutBatchRun.update({
      where: { id: batch.id },
      data: { status: 'COMPLETED', totalAmount, completedAt: new Date() },
    });

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
}

export async function GET(req: NextRequest) {
  return POST(req);
}
