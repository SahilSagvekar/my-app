export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  cancelSubscription,
  createBillingPortalSession,
} from '@/lib/stripe';

// GET - List subscriptions
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');

    const where: any = {};

    // If client user, only show their subscriptions
    if (currentUser.role === 'client' && currentUser.linkedClientId) {
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId: currentUser.linkedClientId },
      });
      if (stripeCustomer) {
        where.stripeCustomerId = stripeCustomer.id;
      } else {
        return NextResponse.json({ ok: true, subscriptions: [] });
      }
    } else if (clientId) {
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId },
      });
      if (stripeCustomer) {
        where.stripeCustomerId = stripeCustomer.id;
      }
    }

    if (status) {
      where.status = status;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        stripeCustomer: {
          include: {
            client: {
              select: { id: true, name: true, companyName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, subscriptions });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// POST - Create subscription checkout or manage subscription
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, clientId, priceId, subscriptionId } = body;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Start new subscription
    if (action === 'subscribe') {
      const authError = requireAdmin(currentUser);
      if (authError && currentUser.role !== 'client') {
        return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
      }

      // Determine client ID
      let targetClientId = clientId;
      if (currentUser.role === 'client' && currentUser.linkedClientId) {
        targetClientId = currentUser.linkedClientId;
      }

      if (!targetClientId || !priceId) {
        return NextResponse.json(
          { ok: false, message: 'clientId and priceId are required' },
          { status: 400 }
        );
      }

      // Get client
      const client = await prisma.client.findUnique({
        where: { id: targetClientId },
      });

      if (!client) {
        return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
      }

      // Get or create Stripe customer
      const stripeCustomer = await getOrCreateStripeCustomer(
        client.id,
        client.email,
        client.companyName || client.name
      );

      // Create checkout session
      const session = await createSubscriptionCheckoutSession(
        stripeCustomer.id,
        priceId,
        `${baseUrl}/billing/subscriptions?success=true`,
        `${baseUrl}/billing/subscriptions?canceled=true`,
        { clientId: targetClientId }
      );

      return NextResponse.json({ ok: true, checkoutUrl: session.url });
    }

    // Cancel subscription
    if (action === 'cancel') {
      if (!subscriptionId) {
        return NextResponse.json({ ok: false, message: 'subscriptionId is required' }, { status: 400 });
      }

      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { stripeCustomer: true },
      });

      if (!subscription) {
        return NextResponse.json({ ok: false, message: 'Subscription not found' }, { status: 404 });
      }

      // Check access
      if (currentUser.role === 'client') {
        const clientStripeCustomer = await prisma.stripeCustomer.findUnique({
          where: { clientId: currentUser.linkedClientId || '' },
        });
        if (!clientStripeCustomer || clientStripeCustomer.id !== subscription.stripeCustomerId) {
          return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
        }
      }

      // Cancel in Stripe (at period end by default)
      const cancelAtPeriodEnd = body.cancelAtPeriodEnd !== false;
      await cancelSubscription(subscription.stripeSubscriptionId, cancelAtPeriodEnd);

      // Update our record
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd,
          canceledAt: cancelAtPeriodEnd ? null : new Date(),
          status: cancelAtPeriodEnd ? subscription.status : 'CANCELED',
        },
      });

      return NextResponse.json({ ok: true, message: 'Subscription canceled' });
    }

    // Open billing portal for self-service
    if (action === 'portal') {
      let targetClientId = clientId;
      if (currentUser.role === 'client' && currentUser.linkedClientId) {
        targetClientId = currentUser.linkedClientId;
      }

      if (!targetClientId) {
        return NextResponse.json({ ok: false, message: 'clientId is required' }, { status: 400 });
      }

      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId: targetClientId },
      });

      if (!stripeCustomer) {
        return NextResponse.json({ ok: false, message: 'No billing account found' }, { status: 404 });
      }

      const session = await createBillingPortalSession(
        stripeCustomer.stripeCustomerId,
        `${baseUrl}/billing`
      );

      return NextResponse.json({ ok: true, portalUrl: session.url });
    }

    return NextResponse.json({ ok: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing subscription:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
