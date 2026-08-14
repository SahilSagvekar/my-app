export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  client as clientTable,
  clientPortalAccess as clientPortalAccessTable,
  stripeCustomer as stripeCustomerTable,
} from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

// GET /api/portal/verify-payment
// Checks if the user's client profile has an active Stripe subscription and unlocks the portal if so.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db.query.client.findFirst({
      where: or(eq(clientTable.userId, user.id), eq(clientTable.email, user.email)),
      with: { clientPortalAccesses: true },
    });

    // clientPortalAccess has a unique clientId FK (1:1), but drizzle-kit
    // introspection mislabels it many() — take the first (only) entry.
    const portalAccess = client?.clientPortalAccesses[0];

    if (!client || !portalAccess) {
      return NextResponse.json({ error: 'Client or portal access not found' }, { status: 404 });
    }

    if (portalAccess.status === 'ACTIVE') {
      return NextResponse.json({ success: true, status: 'ACTIVE', message: 'Already active' });
    }

    // Look up stripe customer
    const [stripeCustomer] = await db
      .select()
      .from(stripeCustomerTable)
      .where(eq(stripeCustomerTable.clientId, client.id))
      .limit(1);

    if (!stripeCustomer) {
      return NextResponse.json({ success: false, message: 'No Stripe customer found' });
    }

    // Check if they have an active subscription in Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      // Unlock the portal!
      const now = new Date();
      const nextBilling = new Date(now);
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      const updateData: any = {
        status: 'ACTIVE',
        lockedAt: null,
        nextBillingDate: nextBilling.toISOString(),
        updatedAt: now.toISOString(),
      };

      if (!portalAccess.billingAnchorDate) {
        updateData.billingAnchorDate = now.toISOString();
      }

      await db.update(clientPortalAccessTable).set(updateData).where(eq(clientPortalAccessTable.clientId, client.id));

      console.log(`🔓 [Portal] Manual Verification — unlocked for: ${client.name}`);
      return NextResponse.json({ success: true, status: 'ACTIVE' });
    }

    return NextResponse.json({ success: false, status: portalAccess.status, message: 'No active subscription found' });
  } catch (err: any) {
    console.error('GET /api/portal/verify-payment error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
