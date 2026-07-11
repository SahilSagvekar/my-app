export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getOrCreateConnectAccount, createOnboardingLink } from '@/lib/stripe-payouts';

const SALES_ROLES = ['sales', 'sales_manager'];

// GET /api/payouts/onboarding — current rep's payout onboarding status
export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.salesRepPayoutProfile.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    success: true,
    data: {
      hasAccount: !!profile?.stripeConnectAccountId,
      onboardingStatus: profile?.onboardingStatus ?? 'NOT_STARTED',
      payoutsEnabled: profile?.payoutsEnabled ?? false,
      country: profile?.country ?? null,
      currency: profile?.currency ?? null,
      taxFormType: profile?.taxFormType ?? null,
      taxFormSubmitted: !!profile?.taxFormCollectedAt,
    },
  });
}

// POST /api/payouts/onboarding — start or resume the hosted onboarding flow.
// Body: { country: string (ISO 3166-1 alpha-2) } — required only on first call,
// since Stripe locks the country at account creation.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!SALES_ROLES.includes(user.role ?? '') && user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const existing = await prisma.salesRepPayoutProfile.findUnique({ where: { userId: user.id } });

  if (!existing?.taxFormCollectedAt) {
    return NextResponse.json(
      { success: false, error: 'Submit your W-9 tax form before setting up payouts' },
      { status: 400 }
    );
  }

  const country = existing?.country || body.country;
  if (!country) {
    return NextResponse.json(
      { success: false, error: 'country is required to start payout onboarding' },
      { status: 400 }
    );
  }

  try {
    const { accountId } = await getOrCreateConnectAccount(user.id, country, user.email);

    const origin = req.nextUrl.origin;
    const url = await createOnboardingLink(
      accountId,
      `${origin}/dashboard?payoutOnboarding=refresh`,
      `${origin}/dashboard?payoutOnboarding=complete`
    );

    return NextResponse.json({ success: true, data: { url } });
  } catch (err: any) {
    console.error('[payouts/onboarding] failed to create onboarding link:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to start payout onboarding', details: err.message },
      { status: 500 }
    );
  }
}
