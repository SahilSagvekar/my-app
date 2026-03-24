export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { stripe, toCents } from '@/lib/stripe';

// GET - List billing plans
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const plans = await prisma.billingPlan.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { amount: 'asc' },
    });

    return NextResponse.json({ ok: true, plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// POST - Create a new billing plan (creates Stripe product + price)
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const body = await req.json();
    const {
      name,
      description,
      amount, // in dollars
      interval = 'month', // 'month' or 'year'
      features = [],
    } = body;

    if (!name || !amount) {
      return NextResponse.json(
        { ok: false, message: 'name and amount are required' },
        { status: 400 }
      );
    }

    // Create Stripe product
    const product = await stripe.products.create({
      name,
      description: description || undefined,
      metadata: { source: 'e8_billing' },
    });

    // Create Stripe price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: toCents(amount),
      currency: 'usd',
      recurring: { interval },
    });

    // Save to our database
    const plan = await prisma.billingPlan.create({
      data: {
        name,
        description,
        stripePriceId: price.id,
        stripeProductId: product.id,
        amount: toCents(amount),
        currency: 'usd',
        interval,
        features,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, plan });
  } catch (error: any) {
    console.error('Error creating plan:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// PATCH - Update a billing plan
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const body = await req.json();
    const { id, name, description, features, isActive } = body;

    if (!id) {
      return NextResponse.json({ ok: false, message: 'id is required' }, { status: 400 });
    }

    const plan = await prisma.billingPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ ok: false, message: 'Plan not found' }, { status: 404 });
    }

    // Update Stripe product if name/description changed
    if (name || description) {
      await stripe.products.update(plan.stripeProductId, {
        name: name || undefined,
        description: description || undefined,
      });
    }

    // Update Stripe price active status
    if (isActive !== undefined) {
      await stripe.prices.update(plan.stripePriceId, {
        active: isActive,
      });
    }

    // Update our record
    const updatedPlan = await prisma.billingPlan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(features && { features }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ ok: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('Error updating plan:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
