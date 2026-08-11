export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stripeCustomer, subscription, client as clientTable } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
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

    const conditions: any[] = [];

    // If client user, only show their subscriptions
    if (currentUser.role === 'client' && currentUser.linkedClientId) {
      const [foundStripeCustomer] = await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, currentUser.linkedClientId)).limit(1);
      if (foundStripeCustomer) {
        conditions.push(eq(subscription.stripeCustomerId, foundStripeCustomer.id));
      } else {
        return NextResponse.json({ ok: true, subscriptions: [] });
      }
    } else if (clientId) {
      const [foundStripeCustomer] = await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, clientId)).limit(1);
      if (foundStripeCustomer) {
        conditions.push(eq(subscription.stripeCustomerId, foundStripeCustomer.id));
      }
    }

    if (status) {
      conditions.push(eq(subscription.status, status as any));
    }

    const subscriptions = await db.query.subscription.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: {
        stripeCustomer: {
          with: {
            client: {
              columns: { id: true, name: true, companyName: true, email: true },
            },
          },
        },
      },
      orderBy: desc(subscription.createdAt),
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
      const [client] = await db.select().from(clientTable).where(eq(clientTable.id, targetClientId)).limit(1);

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

      const foundSubscription = await db.query.subscription.findFirst({
        where: eq(subscription.id, subscriptionId),
        with: { stripeCustomer: true },
      });

      if (!foundSubscription) {
        return NextResponse.json({ ok: false, message: 'Subscription not found' }, { status: 404 });
      }

      // Check access
      if (currentUser.role === 'client') {
        const [clientStripeCustomer] = await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, currentUser.linkedClientId || '')).limit(1);
        if (!clientStripeCustomer || clientStripeCustomer.id !== foundSubscription.stripeCustomerId) {
          return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
        }
      }

      // Cancel in Stripe (at period end by default)
      const cancelAtPeriodEnd = body.cancelAtPeriodEnd !== false;
      await cancelSubscription(foundSubscription.stripeSubscriptionId, cancelAtPeriodEnd);

      // Update our record
      await db.update(subscription).set({
        cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? null : new Date().toISOString(),
        status: cancelAtPeriodEnd ? foundSubscription.status : 'CANCELED',
        updatedAt: new Date().toISOString(),
      }).where(eq(subscription.id, subscriptionId));

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

      const [foundStripeCustomer] = await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, targetClientId)).limit(1);

      if (!foundStripeCustomer) {
        return NextResponse.json({ ok: false, message: 'No billing account found' }, { status: 404 });
      }

      const session = await createBillingPortalSession(
        foundStripeCustomer.stripeCustomerId,
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
