export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { salesRepPayoutProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { syncAccountStatus } from '@/lib/stripe-payouts';

// POST /api/payouts/onboarding/sync — re-check Stripe account status.
// Called client-side when the rep lands back on ?payoutOnboarding=complete,
// and independently from the account.updated Connect webhook as source of truth.
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  const user = await getCurrentUser2(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const [profile] = await db.select().from(salesRepPayoutProfile).where(eq(salesRepPayoutProfile.userId, user.id)).limit(1);
  if (!profile?.stripeConnectAccountId) {
    return NextResponse.json({ success: false, error: 'No payout account found' }, { status: 404 });
  }

  await syncAccountStatus(profile.stripeConnectAccountId);

  const [updated] = await db.select().from(salesRepPayoutProfile).where(eq(salesRepPayoutProfile.userId, user.id)).limit(1);

  return NextResponse.json({
    success: true,
    data: {
      onboardingStatus: updated?.onboardingStatus,
      payoutsEnabled: updated?.payoutsEnabled,
    },
  });
}
