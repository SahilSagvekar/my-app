export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe';

const STORAGE_PLANS: Record<string, { name: string; amount: number; addBytes: bigint }> = {
  '1tb': {
    name: 'Additional 1 TB Storage',
    amount: 4900,
    addBytes: BigInt(1024) ** BigInt(4),
  },
  '3tb': {
    name: 'Additional 3 TB Storage',
    amount: 9900,
    addBytes: BigInt(3) * (BigInt(1024) ** BigInt(4)),
  },
  unlimited: {
    name: 'Unlimited Storage',
    amount: 19900,
    addBytes: BigInt(1000) * (BigInt(1024) ** BigInt(4)),
  },
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: clientId } = await context.params;
    const { planId = '3tb' } = await request.json();
    const plan = STORAGE_PLANS[planId];

    if (!plan) {
      return NextResponse.json({ ok: false, message: 'Invalid storage plan' }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, name: true, companyName: true, userId: true },
    });

    if (!client) {
      return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
    }

    const canBuy =
      user.role === 'admin' ||
      user.role === 'manager' ||
      (user.role === 'client' && (user.linkedClientId === clientId || user.id === client.userId || user.email === client.email));

    if (!canBuy) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const customer = await getOrCreateStripeCustomer(
      client.id,
      client.email,
      client.companyName || client.name,
      { clientId: client.id }
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' },
            product_data: {
              name: plan.name,
              metadata: {
                type: 'storage_upgrade',
                clientId: client.id,
                addBytes: plan.addBytes.toString(),
              },
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          type: 'storage_upgrade',
          clientId: client.id,
          planId,
          addBytes: plan.addBytes.toString(),
        },
      },
      metadata: {
        type: 'storage_upgrade',
        clientId: client.id,
        planId,
        addBytes: plan.addBytes.toString(),
      },
      success_url: `${baseUrl}/dashboard?storage=success`,
      cancel_url: `${baseUrl}/dashboard?storage=canceled`,
    });

    return NextResponse.json({ ok: true, checkoutUrl: session.url });
  } catch (error: any) {
    console.error('Storage checkout error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Failed to start checkout' },
      { status: 500 }
    );
  }
}
