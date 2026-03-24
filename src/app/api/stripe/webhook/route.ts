export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { stripe, constructWebhookEvent, STRIPE_WEBHOOK_EVENTS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`📩 Stripe webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_FAILED:
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAID:
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_FINALIZED:
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED:
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case STRIPE_WEBHOOK_EVENTS.PAYMENT_METHOD_ATTACHED:
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case STRIPE_WEBHOOK_EVENTS.PAYMENT_METHOD_DETACHED:
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`✅ PaymentIntent succeeded: ${paymentIntent.id}`);

  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  // Update invoice and create payment record
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    // Create payment record
    await tx.payment.create({
      data: {
        invoiceId,
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge as string,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'SUCCEEDED',
        paymentMethod: paymentIntent.payment_method_types[0],
        receiptUrl: null, // Will be updated from charge
      },
    });

    // Update invoice
    const newAmountPaid = invoice.amountPaid + paymentIntent.amount;
    const isPaid = newAmountPaid >= invoice.amount;

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
        paidAt: isPaid ? new Date() : null,
      },
    });
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`❌ PaymentIntent failed: ${paymentIntent.id}`);

  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  await prisma.payment.create({
    data: {
      invoiceId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'FAILED',
      paymentMethod: paymentIntent.payment_method_types[0],
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
    },
  });
}

async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  console.log(`✅ Stripe Invoice paid: ${stripeInvoice.id}`);

  // Find our invoice by Stripe invoice ID
  const invoice = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });

  if (invoice) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        amountPaid: stripeInvoice.amount_paid,
        paidAt: new Date(),
      },
    });
  }
}

async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  console.log(`❌ Stripe Invoice payment failed: ${stripeInvoice.id}`);

  const invoice = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });

  if (invoice) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.dueDate && new Date() > invoice.dueDate ? 'OVERDUE' : 'PENDING',
      },
    });
  }
}

async function handleInvoiceFinalized(stripeInvoice: Stripe.Invoice) {
  console.log(`📄 Stripe Invoice finalized: ${stripeInvoice.id}`);

  const invoice = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });

  if (invoice) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripeHostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
        stripePdfUrl: stripeInvoice.invoice_pdf,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`🔄 Subscription created: ${subscription.id}`);

  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: subscription.customer as string },
  });

  if (!stripeCustomer) {
    console.error('No StripeCustomer found for:', subscription.customer);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const amount = subscription.items.data[0]?.price.unit_amount || 0;

  await prisma.subscription.create({
    data: {
      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: mapSubscriptionStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      amount,
      currency: subscription.currency,
      interval: subscription.items.data[0]?.price.recurring?.interval || 'month',
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`🔄 Subscription updated: ${subscription.id}`);

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existing) {
    // If doesn't exist, create it
    await handleSubscriptionCreated(subscription);
    return;
  }

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: mapSubscriptionStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`🗑️ Subscription deleted: ${subscription.id}`);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
    },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`✅ Checkout completed: ${session.id}`);

  const { invoiceId, type } = session.metadata || {};

  if (type === 'invoice_payment' && invoiceId) {
    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        stripePaymentIntentId: session.payment_intent as string,
      },
    });
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`💳 Payment method attached: ${paymentMethod.id}`);

  const customerId = paymentMethod.customer as string;
  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!stripeCustomer) return;

  const data: any = {
    stripeCustomerId: stripeCustomer.id,
    stripePaymentMethodId: paymentMethod.id,
    type: paymentMethod.type,
    isDefault: false,
  };

  if (paymentMethod.type === 'card' && paymentMethod.card) {
    data.cardBrand = paymentMethod.card.brand;
    data.cardLast4 = paymentMethod.card.last4;
    data.cardExpMonth = paymentMethod.card.exp_month;
    data.cardExpYear = paymentMethod.card.exp_year;
  }

  if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
    data.bankName = paymentMethod.us_bank_account.bank_name;
    data.bankLast4 = paymentMethod.us_bank_account.last4;
    data.bankAccountType = paymentMethod.us_bank_account.account_type;
  }

  await prisma.paymentMethod.upsert({
    where: { stripePaymentMethodId: paymentMethod.id },
    create: data,
    update: data,
  });
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`💳 Payment method detached: ${paymentMethod.id}`);

  await prisma.paymentMethod.delete({
    where: { stripePaymentMethodId: paymentMethod.id },
  }).catch(() => {
    // Ignore if doesn't exist
  });
}

// Helper to map Stripe subscription status to our enum
function mapSubscriptionStatus(status: Stripe.Subscription.Status): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING' | 'PAUSED' {
  const statusMap: Record<string, any> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    trialing: 'TRIALING',
    paused: 'PAUSED',
    incomplete: 'UNPAID',
    incomplete_expired: 'CANCELED',
  };
  return statusMap[status] || 'ACTIVE';
}