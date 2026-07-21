export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe';

// POST /api/portal/setup-subscription
// Called from the client portal contracts & billing page after contract is signed.
// Creates a Stripe Checkout session for the first payment + recurring subscription.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the client for this user
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

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client.portalAccess || client.portalAccess.status !== 'PAYMENT_PENDING') {
      return NextResponse.json(
        { error: 'Payment setup not available yet — contract must be signed first' },
        { status: 400 }
      );
    }

    // Get the accepted (or latest) quote to know the amount
    const preClient = client.preClientId
      ? await prisma.preClient.findUnique({
          where: { id: client.preClientId },
          include: {
            quotes: {
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        })
      : null;

    const acceptedQuote = preClient?.quotes[0];
    const amountCents: number = acceptedQuote?.totalAmount ?? 0;

    if (amountCents <= 0) {
      console.error(`[Setup Subscription] No valid quote amount found for client ${client.id}. PreClient ID: ${client.preClientId}, Quote ID: ${acceptedQuote?.id}, Amount: ${acceptedQuote?.totalAmount}`);
      return NextResponse.json({ error: 'No quote amount found' }, { status: 400 });
    }

    // Get or create Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer(
      client.id,
      client.email,
      client.companyName || client.name,
      { clientId: client.id, source: 'onboarding_pipeline' }
    );

    // Idempotency: a double-click (or a retry before the redirect fires)
    // must not mint a second subscription for the same client. If they
    // already have an active subscription, or an open checkout session from
    // a previous call, reuse/reject instead of creating another one.
    const existingActiveSubscription = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
      status: 'active',
      limit: 1,
    });
    if (existingActiveSubscription.data.length > 0) {
      return NextResponse.json({ error: 'A subscription already exists for this account' }, { status: 400 });
    }

    const recentSessions = await stripe.checkout.sessions.list({
      customer: stripeCustomer.id,
      limit: 5,
    });
    const reusableSession = recentSessions.data.find(
      (s) => s.status === 'open' && s.mode === 'subscription' && s.metadata?.source === 'onboarding_pipeline'
    );
    if (reusableSession) {
      return NextResponse.json({ checkoutUrl: reusableSession.url });
    }

    // Create a Stripe Price on the fly (recurring monthly)
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: amountCents,
      recurring: { interval: 'month' },
      product_data: {
        name: `E8 Productions Monthly Service — ${client.companyName || client.name}`,
        metadata: { clientId: client.id },
      },
      metadata: { clientId: client.id },
    });

    // Create Stripe Checkout session for subscription
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomer.id,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?payment=success`,
      cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      metadata: {
        clientId: client.id,
        source: 'onboarding_pipeline',
      },
      subscription_data: {
        metadata: {
          clientId: client.id,
          source: 'onboarding_pipeline',
        },
      },
      payment_method_collection: 'always',
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error('POST /api/portal/setup-subscription error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
