export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { stripeCustomer, client as clientTable, paymentMethod } from '@/lib/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import {
  stripe,
  getOrCreateStripeCustomer,
  getPaymentMethods,
  setDefaultPaymentMethod,
} from '@/lib/stripe';

// GET - Get customer billing info and payment methods
export async function GET(req: NextRequest) {
  const db = getDbHttp();
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
    const foundStripeCustomer = await db.query.stripeCustomer.findFirst({
      where: eq(stripeCustomer.clientId, clientId),
      with: {
        client: {
          columns: { id: true, name: true, companyName: true, email: true },
        },
        paymentMethods: {
          orderBy: (pm, { desc }) => desc(pm.createdAt),
        },
        subscriptions: {
          where: (s, { inArray }) => inArray(s.status, ['ACTIVE', 'TRIALING', 'PAST_DUE'] as any),
        },
      },
    });

    if (!foundStripeCustomer) {
      return NextResponse.json({
        ok: true,
        customer: null,
        paymentMethods: [],
        hasStripeAccount: false,
      });
    }

    return NextResponse.json({
      ok: true,
      customer: foundStripeCustomer,
      paymentMethods: foundStripeCustomer.paymentMethods,
      hasStripeAccount: true,
    });
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// POST - Create Stripe customer or setup payment method
export async function POST(req: NextRequest) {
  const db = getDbHttp();
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
    const [client] = await db.select().from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

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

      const [foundStripeCustomer] = await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, clientId)).limit(1);

      if (!foundStripeCustomer) {
        return NextResponse.json({ ok: false, message: 'No billing account' }, { status: 404 });
      }

      // Update in Stripe
      await setDefaultPaymentMethod(foundStripeCustomer.stripeCustomerId, paymentMethodId);

      // Update in our DB
      await db.update(paymentMethod).set({
        isDefault: false,
        updatedAt: new Date().toISOString(),
      }).where(eq(paymentMethod.stripeCustomerId, foundStripeCustomer.id));

      await db.update(paymentMethod).set({
        isDefault: true,
        updatedAt: new Date().toISOString(),
      }).where(eq(paymentMethod.stripePaymentMethodId, paymentMethodId));

      await db.update(stripeCustomer).set({
        defaultPaymentMethod: paymentMethodId,
        updatedAt: new Date().toISOString(),
      }).where(eq(stripeCustomer.id, foundStripeCustomer.id));

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
      await db.delete(paymentMethod).where(eq(paymentMethod.stripePaymentMethodId, paymentMethodId)).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing customer:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
