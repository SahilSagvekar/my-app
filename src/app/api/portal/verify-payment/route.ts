export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

// GET /api/portal/verify-payment
// Checks if the user's client profile has an active Stripe subscription and unlocks the portal if so.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { email: user.email },
        ],
      },
      include: {
        portalAccess: true,
      },
    });

    if (!client || !client.portalAccess) {
      return NextResponse.json({ error: 'Client or portal access not found' }, { status: 404 });
    }

    if (client.portalAccess.status === 'ACTIVE') {
      return NextResponse.json({ success: true, status: 'ACTIVE', message: 'Already active' });
    }

    // Look up stripe customer
    const stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { clientId: client.id }
    });

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
        nextBillingDate: nextBilling,
      };

      if (!client.portalAccess.billingAnchorDate) {
        updateData.billingAnchorDate = now;
      }

      await prisma.clientPortalAccess.update({
        where: { clientId: client.id },
        data: updateData,
      });

      console.log(`🔓 [Portal] Manual Verification — unlocked for: ${client.name}`);
      return NextResponse.json({ success: true, status: 'ACTIVE' });
    }

    return NextResponse.json({ success: false, status: client.portalAccess.status, message: 'No active subscription found' });
  } catch (err: any) {
    console.error('GET /api/portal/verify-payment error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
