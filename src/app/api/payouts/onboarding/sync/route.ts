export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { syncAccountStatus } from '@/lib/stripe-payouts';

// POST /api/payouts/onboarding/sync — re-check Stripe account status.
// Called client-side when the rep lands back on ?payoutOnboarding=complete,
// and independently from the account.updated Connect webhook as source of truth.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.salesRepPayoutProfile.findUnique({ where: { userId: user.id } });
  if (!profile?.stripeConnectAccountId) {
    return NextResponse.json({ success: false, error: 'No payout account found' }, { status: 404 });
  }

  await syncAccountStatus(profile.stripeConnectAccountId);

  const updated = await prisma.salesRepPayoutProfile.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    success: true,
    data: {
      onboardingStatus: updated?.onboardingStatus,
      payoutsEnabled: updated?.payoutsEnabled,
    },
  });
}
