import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { stripe } from '@/lib/stripe';
import { getDb } from '@/lib/db';
import { salesRepPayoutProfile, affiliateCommission, commissionPayout } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq } from 'drizzle-orm';

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
  const { db, closeDb } = getDb();
  try {
  const [existing] = await db.select().from(salesRepPayoutProfile).where(eq(salesRepPayoutProfile.userId, userId)).limit(1);

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

  const now = new Date().toISOString();
  const [profile] = await db.insert(salesRepPayoutProfile).values({
    id: createId(),
    userId,
    stripeConnectAccountId: account.id,
    onboardingStatus: 'IN_PROGRESS',
    country,
    currency: account.default_currency ?? 'usd',
    updatedAt: now,
  }).onConflictDoUpdate({
    target: salesRepPayoutProfile.userId,
    set: {
      stripeConnectAccountId: account.id,
      onboardingStatus: 'IN_PROGRESS',
      country,
      updatedAt: now,
    },
  }).returning();

  return { accountId: account.id, profileId: profile.id };

  } finally {
    await closeDb();
  }
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
  const { db, closeDb } = getDb();
  try {
  const account = await stripe.accounts.retrieve(accountId);
  const payoutsEnabled = !!account.payouts_enabled;

  const updateData: any = {
    payoutsEnabled,
    onboardingStatus: payoutsEnabled ? 'COMPLETE' : 'IN_PROGRESS',
    taxFormType: account.country === 'US' ? 'W9' : 'W8BEN',
    updatedAt: new Date().toISOString(),
  };
  if (account.default_currency) updateData.currency = account.default_currency;
  if (payoutsEnabled) updateData.taxFormCollectedAt = new Date().toISOString();

  await db.update(salesRepPayoutProfile).set(updateData).where(eq(salesRepPayoutProfile.stripeConnectAccountId, accountId));

  } finally {
    await closeDb();
  }
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
  const { db, closeDb } = getDb();
  try {
  const commissionRow = await db.query.affiliateCommission.findFirst({
    where: eq(affiliateCommission.id, commissionId),
    with: { user: { with: { salesRepPayoutProfiles: true } } },
  });
  if (!commissionRow) {
    throw new Error(`Commission ${commissionId} not found`);
  }
  const commission = commissionRow;

  if (commission.status !== 'APPROVED') {
    throw new PayoutError(
      `Commission ${commissionId} is not in APPROVED state (found ${commission.status})`,
      'NOT_APPROVED'
    );
  }

  // salesRepPayoutProfile has a unique userId FK (1:1), but drizzle-kit
  // introspection mislabels it many() — take the first (only) entry.
  const profile = commission.user.salesRepPayoutProfiles[0];
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
  const flip = await db.update(affiliateCommission).set({
    status: 'PAYOUT_PENDING',
    updatedAt: new Date().toISOString(),
  }).where(and(
    eq(affiliateCommission.id, commissionId),
    eq(affiliateCommission.status, 'APPROVED'),
  )).returning();
  if (flip.length === 0) {
    throw new PayoutError(
      `Commission ${commissionId} was claimed by another payout attempt`,
      'ALREADY_CLAIMED'
    );
  }

  const [payout] = await db.insert(commissionPayout).values({
    id: createId(),
    salesUserId: commission.salesUserId,
    amount: commission.commissionAmt,
    currency: commission.currency,
    status: 'PENDING',
    idempotencyKey: payoutIdempotencyKey(commissionId, batchId),
    batchId,
    updatedAt: new Date().toISOString(),
  }).returning();

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

    const sentNow = new Date().toISOString();
    await db.batch([
      db.update(commissionPayout).set({
        stripeTransferId: transfer.id, status: 'SENT', sentAt: sentNow, updatedAt: sentNow,
      }).where(eq(commissionPayout.id, payout.id)),
      db.update(affiliateCommission).set({
        payoutId: payout.id, updatedAt: sentNow,
      }).where(eq(affiliateCommission.id, commissionId)),
    ] as any);

    return { payoutId: payout.id, transferId: transfer.id, status: 'SENT' };
  } catch (err: any) {
    const failedNow = new Date().toISOString();
    await db.batch([
      db.update(commissionPayout).set({
        status: 'FAILED', failedAt: failedNow, failureReason: err.message ?? 'Unknown Stripe error', updatedAt: failedNow,
      }).where(eq(commissionPayout.id, payout.id)),
      db.update(affiliateCommission).set({
        status: 'FAILED', payoutId: payout.id, updatedAt: failedNow,
      }).where(eq(affiliateCommission.id, commissionId)),
    ] as any);
    throw err;
  }

  } finally {
    await closeDb();
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
