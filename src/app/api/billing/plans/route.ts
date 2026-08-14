export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { billingPlan } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, asc } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { stripe, toCents } from '@/lib/stripe';

// GET - List billing plans
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const plans = await db.select().from(billingPlan)
      .where(activeOnly ? eq(billingPlan.isActive, true) : undefined)
      .orderBy(asc(billingPlan.amount));

    return NextResponse.json({ ok: true, plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// POST - Create a new billing plan (creates Stripe product + price)
export async function POST(req: NextRequest) {
  const db = getDbHttp();
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
    const [plan] = await db.insert(billingPlan).values({
      id: createId(),
      name,
      description,
      stripePriceId: price.id,
      stripeProductId: product.id,
      amount: toCents(amount),
      currency: 'usd',
      interval,
      features,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ ok: true, plan });
  } catch (error: any) {
    console.error('Error creating plan:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// PATCH - Update a billing plan
export async function PATCH(req: NextRequest) {
  const db = getDbHttp();
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

    const [plan] = await db.select().from(billingPlan).where(eq(billingPlan.id, id)).limit(1);
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
    const [updatedPlan] = await db.update(billingPlan).set({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(features && { features }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
    }).where(eq(billingPlan.id, id)).returning();

    return NextResponse.json({ ok: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('Error updating plan:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
