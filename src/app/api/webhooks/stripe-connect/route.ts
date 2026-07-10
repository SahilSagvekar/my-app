export const dynamic = 'force-dynamic';

// Stripe Connect webhook — commission payout status.
//
// Scope note: we treat a successful `transfer.created` as "paid" from E8's
// perspective (funds have left the platform balance into the rep's Stripe
// balance, which is the money movement E8 is responsible for). Whether Stripe
// then pays that balance out to the rep's bank is Stripe's own scheduled
// payout, visible in the rep's Express dashboard — reconciling that second
// hop isn't necessary for commission accounting since E8 has no control over
// or liability for it once transferred.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { syncAccountStatus } from '@/lib/stripe-payouts';
import { notifyUser } from '@/lib/notify';

const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-connect webhook] signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[stripe-connect webhook] received: ${event.type}`);

  try {
    switch (event.type) {
      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;
      case 'transfer.reversed':
        await handleTransferReversed(event.data.object as Stripe.Transfer);
        break;
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        console.log(`[stripe-connect webhook] unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[stripe-connect webhook] handler error for ${event.type}:`, err);
    // Still 200 — Stripe retries on non-2xx, and a handler bug shouldn't cause
    // infinite redelivery. The reconciliation job (task 7) catches drift.
  }

  return NextResponse.json({ received: true });
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const commissionId = transfer.metadata?.commissionId;
  if (!commissionId) return;

  const commission = await prisma.affiliateCommission.findUnique({ where: { id: commissionId } });
  if (!commission || commission.status !== 'PAYOUT_PENDING') return; // already processed or not ours

  await prisma.$transaction([
    prisma.commissionPayout.updateMany({
      where: { stripeTransferId: transfer.id },
      data: { status: 'PAID', paidAt: new Date() },
    }),
    prisma.affiliateCommission.update({
      where: { id: commissionId },
      data: { status: 'PAID', paidAt: new Date() },
    }),
  ]);

  await notifyUser({
    userId: commission.salesUserId,
    type: 'commission_paid',
    title: 'Commission paid',
    body: `Your commission of $${Number(commission.commissionAmt).toFixed(2)} has been sent.`,
    channels: ['in-app', 'slack'],
  });
}

async function handleTransferReversed(transfer: Stripe.Transfer) {
  const commissionId = transfer.metadata?.commissionId;
  if (!commissionId) return;

  const commission = await prisma.affiliateCommission.findUnique({ where: { id: commissionId } });
  if (!commission) return;

  await prisma.$transaction([
    prisma.commissionPayout.updateMany({
      where: { stripeTransferId: transfer.id },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: 'Transfer reversed by Stripe' },
    }),
    prisma.affiliateCommission.update({
      where: { id: commissionId },
      data: { status: 'FAILED' },
    }),
  ]);

  // Admin only — see dev doc 3.3 (rep isn't notified of internal payout failures).
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      notifyUser({
        userId: admin.id,
        type: 'commission_payout_failed',
        title: 'Commission payout failed',
        body: `Transfer for commission ${commissionId} (rep #${commission.salesUserId}) was reversed. Needs manual review.`,
        channels: ['in-app', 'slack'],
      })
    )
  );
}

async function handleAccountUpdated(account: Stripe.Account) {
  await syncAccountStatus(account.id);
}
