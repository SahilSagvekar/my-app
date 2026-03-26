export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import {
  stripe,
  getOrCreateStripeCustomer,
  getPaymentMethods,
  setDefaultPaymentMethod,
} from '@/lib/stripe';

// GET - Get customer billing info and payment methods
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let clientId = searchParams.get('clientId');

    // Client users can only see their own info
    if (currentUser.role === 'client' && currentUser.linkedClientId) {
      clientId = currentUser.linkedClientId;
    }

    if (!clientId) {
      return NextResponse.json({ ok: false, message: 'clientId is required' }, { status: 400 });
    }

    // Get stripe customer
    const stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { clientId },
      include: {
        client: {
          select: { id: true, name: true, companyName: true, email: true },
        },
        paymentMethods: {
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
        },
      },
    });

    if (!stripeCustomer) {
      return NextResponse.json({
        ok: true,
        customer: null,
        paymentMethods: [],
        hasStripeAccount: false,
      });
    }

    return NextResponse.json({
      ok: true,
      customer: stripeCustomer,
      paymentMethods: stripeCustomer.paymentMethods,
      hasStripeAccount: true,
    });
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// POST - Create Stripe customer or setup payment method
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, clientId: bodyClientId } = body;

    // Determine client ID
    let clientId = bodyClientId;
    if (currentUser.role === 'client' && currentUser.linkedClientId) {
      clientId = currentUser.linkedClientId;
    }

    if (!clientId) {
      return NextResponse.json({ ok: false, message: 'clientId is required' }, { status: 400 });
    }

    // Get client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create or get Stripe customer
    if (action === 'create_customer' || action === 'setup') {
      const stripeCustomer = await getOrCreateStripeCustomer(
        client.id,
        client.email,
        client.companyName || client.name
      );

      // For 'setup', create a SetupIntent for adding payment method
      if (action === 'setup') {
        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomer.id,
          payment_method_types: ['card', 'us_bank_account'],
          usage: 'off_session',
        });

        return NextResponse.json({
          ok: true,
          clientSecret: setupIntent.client_secret,
          customerId: stripeCustomer.id,
        });
      }

      return NextResponse.json({ ok: true, customerId: stripeCustomer.id });
    }

    // Create checkout session for adding payment method
    if (action === 'add_payment_method') {
      const stripeCustomer = await getOrCreateStripeCustomer(
        client.id,
        client.email,
        client.companyName || client.name
      );

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomer.id,
        mode: 'setup',
        payment_method_types: ['card', 'us_bank_account'],
        success_url: `${baseUrl}/billing?setup=success`,
        cancel_url: `${baseUrl}/billing?setup=canceled`,
      });

      return NextResponse.json({ ok: true, checkoutUrl: session.url });
    }

    // Set default payment method
    if (action === 'set_default') {
      const { paymentMethodId } = body;
      if (!paymentMethodId) {
        return NextResponse.json({ ok: false, message: 'paymentMethodId is required' }, { status: 400 });
      }

      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId },
      });

      if (!stripeCustomer) {
        return NextResponse.json({ ok: false, message: 'No billing account' }, { status: 404 });
      }

      // Update in Stripe
      await setDefaultPaymentMethod(stripeCustomer.stripeCustomerId, paymentMethodId);

      // Update in our DB
      await prisma.paymentMethod.updateMany({
        where: { stripeCustomerId: stripeCustomer.id },
        data: { isDefault: false },
      });

      await prisma.paymentMethod.update({
        where: { stripePaymentMethodId: paymentMethodId },
        data: { isDefault: true },
      });

      await prisma.stripeCustomer.update({
        where: { id: stripeCustomer.id },
        data: { defaultPaymentMethod: paymentMethodId },
      });

      return NextResponse.json({ ok: true });
    }

    // Remove payment method
    if (action === 'remove_payment_method') {
      const { paymentMethodId } = body;
      if (!paymentMethodId) {
        return NextResponse.json({ ok: false, message: 'paymentMethodId is required' }, { status: 400 });
      }

      // Detach from Stripe
      await stripe.paymentMethods.detach(paymentMethodId);

      // Remove from our DB (webhook will also handle this)
      await prisma.paymentMethod.delete({
        where: { stripePaymentMethodId: paymentMethodId },
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing customer:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
