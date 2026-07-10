import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

// Sales rep commission payouts — built on Stripe Connect Express + Transfers.
// See E8_App_Stripe_Commission_Payouts_Dev_Doc for the original spec; Connect was
// chosen over Stripe Global Payouts because Global Payouts is API v2 public preview
// and requires a Money Management Financial Account we haven't provisioned.

export class PayoutError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PayoutError';
  }
}

/**
 * Create (or return existing) Stripe Connect Express account for a sales rep.
 * Country must be known and fixed at account creation — Stripe does not allow
 * changing a connected account's country after creation.
 */
export async function getOrCreateConnectAccount(
  userId: number,
  country: string,
  email: string
): Promise<{ accountId: string; profileId: string }> {
  const existing = await prisma.salesRepPayoutProfile.findUnique({ where: { userId } });

  if (existing?.stripeConnectAccountId) {
    return { accountId: existing.stripeConnectAccountId, profileId: existing.id };
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country,
    email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: { userId: String(userId) },
  });

  const profile = await prisma.salesRepPayoutProfile.upsert({
    where: { userId },
    create: {
      userId,
      stripeConnectAccountId: account.id,
      onboardingStatus: 'IN_PROGRESS',
      country,
      currency: account.default_currency ?? 'usd',
    },
    update: {
      stripeConnectAccountId: account.id,
      onboardingStatus: 'IN_PROGRESS',
      country,
    },
  });

  return { accountId: account.id, profileId: profile.id };
}

/**
 * Stripe-hosted onboarding link — collects bank details, identity, and tax form
 * (W-9 for US, W-8BEN for international) without E8 ever touching raw bank data.
 */
export async function createOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

/**
 * Sync onboarding/payout-eligibility status from Stripe into our profile record.
 * Call after the rep returns from the hosted onboarding flow, and again from the
 * account.updated webhook.
 */
export async function syncAccountStatus(accountId: string): Promise<void> {
  const account = await stripe.accounts.retrieve(accountId);
  const payoutsEnabled = !!account.payouts_enabled;

  await prisma.salesRepPayoutProfile.updateMany({
    where: { stripeConnectAccountId: accountId },
    data: {
      payoutsEnabled,
      onboardingStatus: payoutsEnabled ? 'COMPLETE' : 'IN_PROGRESS',
      currency: account.default_currency ?? undefined,
      taxFormCollectedAt: payoutsEnabled ? new Date() : undefined,
      taxFormType: account.country === 'US' ? 'W9' : 'W8BEN',
    },
  });
}

// Uniqueness here only needs to satisfy CommissionPayout.idempotencyKey's DB
// constraint and give Stripe a fresh key per attempt — the actual double-fire
// guard is the atomic status flip below (APPROVED -> PAYOUT_PENDING).
function payoutIdempotencyKey(commissionId: string, batchId?: string): string {
  return `commission-payout-${commissionId}-${batchId ?? randomUUID()}`;
}

/**
 * Send a single commission's approved amount to the rep's connected account.
 * Caller (batch job) must have already verified: status === APPROVED,
 * holdUntil has passed, and amount is above the configured minimum threshold.
 */
export async function sendCommissionTransfer(
  commissionId: string,
  batchId?: string
): Promise<CommissionPayoutResult> {
  const commission = await prisma.affiliateCommission.findUniqueOrThrow({
    where: { id: commissionId },
    include: { user: { include: { payoutProfile: true } } },
  });

  if (commission.status !== 'APPROVED') {
    throw new PayoutError(
      `Commission ${commissionId} is not in APPROVED state (found ${commission.status})`,
      'NOT_APPROVED'
    );
  }

  const profile = commission.user.payoutProfile;
  if (!profile?.stripeConnectAccountId || !profile.payoutsEnabled) {
    throw new PayoutError(
      `Sales rep ${commission.salesUserId} has no payout-enabled Connect account`,
      'REP_NOT_ONBOARDED'
    );
  }

  const amountDollars = Number(commission.commissionAmt);
  if (!(amountDollars > 0)) {
    throw new PayoutError(`Commission ${commissionId} has non-positive amount`, 'INVALID_AMOUNT');
  }

  // Atomic status flip is the real double-fire guard: if two callers (a manual
  // retry racing the weekly batch, an admin double-click) hit this at once,
  // only one UPDATE ... WHERE status = 'APPROVED' can succeed. The loser sees
  // count 0 and bails before ever calling Stripe.
  const flip = await prisma.affiliateCommission.updateMany({
    where: { id: commissionId, status: 'APPROVED' },
    data: { status: 'PAYOUT_PENDING' },
  });
  if (flip.count === 0) {
    throw new PayoutError(
      `Commission ${commissionId} was claimed by another payout attempt`,
      'ALREADY_CLAIMED'
    );
  }

  const payout = await prisma.commissionPayout.create({
    data: {
      salesUserId: commission.salesUserId,
      amount: commission.commissionAmt,
      currency: commission.currency,
      status: 'PENDING',
      idempotencyKey: payoutIdempotencyKey(commissionId, batchId),
      batchId,
    },
  });

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(amountDollars * 100),
        currency: commission.currency,
        destination: profile.stripeConnectAccountId,
        metadata: {
          commissionId: commission.id,
          salesUserId: String(commission.salesUserId),
          payoutId: payout.id,
        },
      },
      { idempotencyKey: payout.idempotencyKey }
    );

    await prisma.$transaction([
      prisma.commissionPayout.update({
        where: { id: payout.id },
        data: { stripeTransferId: transfer.id, status: 'SENT', sentAt: new Date() },
      }),
      prisma.affiliateCommission.update({
        where: { id: commissionId },
        data: { payoutId: payout.id },
      }),
    ]);

    return { payoutId: payout.id, transferId: transfer.id, status: 'SENT' };
  } catch (err: any) {
    await prisma.$transaction([
      prisma.commissionPayout.update({
        where: { id: payout.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: err.message ?? 'Unknown Stripe error' },
      }),
      prisma.affiliateCommission.update({
        where: { id: commissionId },
        data: { status: 'FAILED', payoutId: payout.id },
      }),
    ]);
    throw err;
  }
}

interface CommissionPayoutResult {
  payoutId: string;
  transferId: string;
  status: 'SENT';
}

export function verifyConnectWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
