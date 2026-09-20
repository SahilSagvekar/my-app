export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { stripe, constructWebhookEvent, STRIPE_WEBHOOK_EVENTS, generateInvoiceNumber, captureTechFeeFromCharge, getChargeIdFromPaymentIntent } from '@/lib/stripe';
import { getDbPool } from '@/lib/db';
import {
  invoice,
  payment,
  subscription as subscriptionTable,
  stripeCustomer as stripeCustomerTable,
  paymentMethod as paymentMethodTable,
  clientPortalAccess,
  client as clientTable,
  stripeWebhookEvent,
  clientExpense,
} from '@/lib/db/schema';

import { createId } from '@/lib/db/id';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import Stripe from 'stripe';
import { sendPaymentNotificationEmail } from '@/lib/email';
import { portalUnlockUpdate, advanceOneCalendarMonth } from '@/lib/auto-invoice';
import { recordPaymentInLedger } from '@/lib/payment-ledger';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDbPool();
  try {
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

    // Idempotency: Stripe retries deliveries that don't get a fast 2xx, and
    // can occasionally send the same event twice. Claim the event id up
    // front — if another delivery already claimed it, skip processing so we
    // never double-create Payments or double-credit an invoice.
    try {
      await db.insert(stripeWebhookEvent).values({ id: event.id, type: event.type });
    } catch (err: any) {
      // Postgres unique_violation SQLSTATE (was Prisma's P2002)
      if (err.code === '23505') {
        console.log(`⏭️ Duplicate Stripe webhook event, skipping: ${event.id} (${event.type})`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err;
    }

    // Handle the event
    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_PROCESSING:
        await handlePaymentIntentProcessing(event.data.object as Stripe.PaymentIntent);
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

  } finally {
    await closeDb();
  }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`✅ PaymentIntent succeeded: ${paymentIntent.id}`);

  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  let fullyPaid = false;

  // Update invoice and create payment record
  await db.transaction(async (tx) => {
    const [foundInvoice] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId)).limit(1);
    if (!foundInvoice) return;

    // Create payment record
    await tx.insert(payment).values({
      id: createId(),
      invoiceId,
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: paymentIntent.latest_charge as string,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'SUCCEEDED',
      paymentMethod: paymentIntent.payment_method_types[0],
      receiptUrl: null, // Will be updated from charge
      updatedAt: new Date().toISOString(),
    });

    // Atomic increment — avoids a lost update if two payments for this
    // invoice land concurrently (a plain read-then-write here would let one
    // overwrite the other's amountPaid).
    const [updated] = await tx.update(invoice).set({
      amountPaid: drizzleSql`${invoice.amountPaid} + ${paymentIntent.amount}`,
      updatedAt: new Date().toISOString(),
    }).where(eq(invoice.id, invoiceId)).returning();

    const isPaid = updated.amountPaid >= updated.amount;
    fullyPaid = isPaid;
    await tx.update(invoice).set({
      status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
      paidAt: isPaid ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(invoice.id, invoiceId));
  });

  // Resolve clientId regardless of fullyPaid — needed for the payment
  // ledger below even on a partial payment, not just portal unlock.
  const rawInvoice = await db.query.invoice.findFirst({
    where: eq(invoice.id, invoiceId),
    with: {
      stripeCustomer: {
        with: { client: { with: { clientPortalAccesses: true } } },
      },
    },
  });
  const clientId = (rawInvoice as any)?.stripeCustomer?.clientId;

  // Every successful payment — partial or full — is real money received
  // this month, so it's recorded regardless of fullyPaid.
  await recordPaymentInLedger(db, clientId, paymentIntent.amount, paymentIntent.currency);

  // Unlock portal for Checkout/PaymentIntent pays (hosted Stripe Invoice
  // unlocks via handleInvoicePaid instead).
  if (fullyPaid) {
    const portalAccess = (rawInvoice as any)?.stripeCustomer?.client?.clientPortalAccesses?.[0];
    if (portalAccess && clientId) {
      const updateData = portalUnlockUpdate({
        autoInvoiceActive: !!portalAccess.autoInvoiceActive,
        existingNextBillingDate: portalAccess.nextBillingDate,
        billingAnchorDate: portalAccess.billingAnchorDate,
        manuallyLocked: portalAccess.status === 'LOCKED' && !!portalAccess.adminUnlockedById,
      });
      await db.update(clientPortalAccess).set(updateData).where(eq(clientPortalAccess.clientId, clientId));
    }
  }

  // Tech Fees: pass Stripe's real processing fee on to the client's next invoice
  const chargeId = typeof paymentIntent.latest_charge === 'string'
    ? paymentIntent.latest_charge
    : (paymentIntent.latest_charge as any)?.id;
  const stripeCustomerId = typeof paymentIntent.customer === 'string'
    ? paymentIntent.customer
    : (paymentIntent.customer as any)?.id;
  await captureTechFeeFromCharge(stripeCustomerId, chargeId, `PaymentIntent ${paymentIntent.id}`);

  } finally {
    await closeDb();
  }
}

// Fires when a payment has been INITIATED but not yet settled — the main
// case is an ACH bank debit, which sits in `processing` for 3-5 business
// days before Stripe confirms success/failure. Without this handler, a
// client paying by bank account would stay LOCKED out of the portal for that
// entire window even though they've already started paying.
//
// This unlocks optimistically and does NOT touch Payment/amountPaid records
// — that accounting only happens in handlePaymentIntentSucceeded /
// handleInvoicePaid once the payment actually clears. If it later fails,
// handlePaymentIntentFailed / handleInvoicePaymentFailed re-lock the portal,
// so the client only gets early access, never permanently-unearned access.
async function handlePaymentIntentProcessing(paymentIntent: Stripe.PaymentIntent) {
  const { db, closeDb } = getDbPool();
  try {
    console.log(`⏳ PaymentIntent processing: ${paymentIntent.id}`);

    // Resolve the local invoice — either a direct PaymentIntent/Checkout pay
    // (carries metadata.invoiceId) or a hosted Stripe Invoice pay (resolve
    // via the Stripe invoice id it's attached to).
    let invoiceId = paymentIntent.metadata?.invoiceId as string | undefined;
    if (!invoiceId && paymentIntent.invoice) {
      const stripeInvoiceId = typeof paymentIntent.invoice === 'string'
        ? paymentIntent.invoice
        : (paymentIntent.invoice as any).id;
      const [found] = await db.select().from(invoice)
        .where(eq(invoice.stripeInvoiceId, stripeInvoiceId)).limit(1);
      invoiceId = found?.id;
    }
    if (!invoiceId) return;

    const rawInvoice = await db.query.invoice.findFirst({
      where: eq(invoice.id, invoiceId),
      with: {
        stripeCustomer: {
          with: { client: { with: { clientPortalAccesses: true } } },
        },
      },
    });

    // Expense reimbursement invoices are independent of subscription/portal
    // access — same exclusion handleInvoicePaid applies.
    if ((rawInvoice?.metadata as any)?.invoiceType === 'EXPENSE') return;

    const portalAccess = (rawInvoice as any)?.stripeCustomer?.client?.clientPortalAccesses?.[0];
    const clientId = (rawInvoice as any)?.stripeCustomer?.clientId;
    if (!portalAccess || !clientId) return;

    // Already unlocked (e.g. duplicate/retried webhook delivery) — nothing to do.
    if (portalAccess.status === 'ACTIVE') return;

    const updateData = portalUnlockUpdate({
      autoInvoiceActive: !!portalAccess.autoInvoiceActive,
      existingNextBillingDate: portalAccess.nextBillingDate,
      billingAnchorDate: portalAccess.billingAnchorDate,
        manuallyLocked: portalAccess.status === 'LOCKED' && !!portalAccess.adminUnlockedById,
    });
    await db.update(clientPortalAccess).set(updateData).where(eq(clientPortalAccess.clientId, clientId));
    console.log(`🔓 [Portal] Unlocked early for client ${clientId} — payment ${paymentIntent.id} initiated (processing, not yet settled)`);
  } finally {
    await closeDb();
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`❌ PaymentIntent failed: ${paymentIntent.id}`);

  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  await db.insert(payment).values({
    id: createId(),
    invoiceId,
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'FAILED',
    paymentMethod: paymentIntent.payment_method_types[0],
    failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
    updatedAt: new Date().toISOString(),
  });

  } finally {
    await closeDb();
  }
}

async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`✅ Stripe Invoice paid: ${stripeInvoice.id}`);

  // Tech Fees: capture Stripe's real processing fee and queue it for this
  // customer's next invoice. Runs regardless of whether we already have a
  // local Invoice record for this one — every successful client payment
  // should generate a Tech Fee.
  {
    const stripeCustomerId = typeof stripeInvoice.customer === 'string'
      ? stripeInvoice.customer
      : (stripeInvoice.customer as any)?.id;
    let chargeId = typeof (stripeInvoice as any).charge === 'string'
      ? (stripeInvoice as any).charge
      : (stripeInvoice as any).charge?.id;
    if (!chargeId && stripeInvoice.payment_intent) {
      const piId = typeof stripeInvoice.payment_intent === 'string'
        ? stripeInvoice.payment_intent
        : (stripeInvoice.payment_intent as any).id;
      chargeId = await getChargeIdFromPaymentIntent(piId);
    }
    await captureTechFeeFromCharge(stripeCustomerId, chargeId, `Invoice ${stripeInvoice.id}`);
  }

  // Find our invoice by Stripe invoice ID
  const rawInvoice = await db.query.invoice.findFirst({
    where: eq(invoice.stripeInvoiceId, stripeInvoice.id),
    with: {
      stripeCustomer: {
        with: { client: { with: { clientPortalAccesses: true } } },
      },
    },
  });
  const foundInvoice = rawInvoice
    ? { ...rawInvoice, stripeCustomer: rawInvoice.stripeCustomer ? { ...rawInvoice.stripeCustomer, client: rawInvoice.stripeCustomer.client ? { ...rawInvoice.stripeCustomer.client, portalAccess: (rawInvoice.stripeCustomer.client as any).clientPortalAccesses?.[0] ?? null } : null } : null }
    : null;

  if (foundInvoice) {
    await db.update(invoice).set({
      status: 'PAID',
      amountPaid: stripeInvoice.amount_paid,
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(invoice.id, foundInvoice.id));

    // If this invoice was created from one or more client expenses (see
    // /api/clients/[id]/expense-trips/[tripId]/invoice), mark them PAID too.
    await db.update(clientExpense).set({
      status: 'PAID',
      updatedAt: new Date().toISOString(),
    }).where(eq(clientExpense.invoiceId, foundInvoice.id));

    // Record this payment in the monthly ledger regardless of invoice type
    // (recurring, one-off, or expense) — it's real money received either way.
    await recordPaymentInLedger(
      db,
      (foundInvoice.stripeCustomer as any)?.clientId,
      stripeInvoice.amount_paid,
      stripeInvoice.currency
    );

    // ── Portal unlock logic ────────────────────────────────────────────────
    // When auto-invoice owns the schedule, do NOT rewrite nextBillingDate —
    // the cron already advanced it when the invoice was created.
    const client = (foundInvoice.stripeCustomer as any)?.client;
    // Expense reimbursement invoices must not change subscription/portal
    // access: they are independent, one-off invoices.
    if (client?.portalAccess && (foundInvoice.metadata as any)?.invoiceType !== 'EXPENSE') {
      const portalAccess = client.portalAccess;
      const updateData = portalUnlockUpdate({
        autoInvoiceActive: !!portalAccess.autoInvoiceActive,
        existingNextBillingDate: portalAccess.nextBillingDate,
        billingAnchorDate: portalAccess.billingAnchorDate,
        manuallyLocked: portalAccess.status === 'LOCKED' && !!portalAccess.adminUnlockedById,
      });

      await db.update(clientPortalAccess).set(updateData).where(eq(clientPortalAccess.clientId, client.id));

      console.log(
        `🔓 [Portal] Unlocked for client: ${client.name}` +
          (portalAccess.autoInvoiceActive
            ? ' (schedule preserved — auto-invoice active)'
            : ` | next billing: ${updateData.nextBillingDate}`)
      );
    }
    // ──────────────────────────────────────────────────────────────────────

    // Also handle invoice paid for checkout session (first payment via Stripe Checkout)
    // The stripeCustomer may be resolved via Stripe metadata if no invoice record exists yet
    const clientName = (foundInvoice.stripeCustomer as any)?.client?.companyName ||
                       (foundInvoice.stripeCustomer as any)?.client?.name ||
                       'Client';
    const clientEmail = (foundInvoice.stripeCustomer as any)?.client?.email || stripeInvoice.customer_email;

    await sendPaymentNotificationEmail({
      type: 'invoice_paid',
      invoiceNumber: foundInvoice.invoiceNumber,
      clientName,
      clientEmail: clientEmail || 'N/A',
      amount: stripeInvoice.amount_paid / 100,
      invoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      pdfUrl: stripeInvoice.invoice_pdf || undefined,
    });
  } else {
    // No invoice record yet — this may be the first Checkout payment
    // Resolve via Stripe customer metadata
    await handleFirstCheckoutPayment(stripeInvoice);
  }

  } finally {
    await closeDb();
  }
}

async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`❌ Stripe Invoice payment failed: ${stripeInvoice.id}`);

  const rawInvoice = await db.query.invoice.findFirst({
    where: eq(invoice.stripeInvoiceId, stripeInvoice.id),
    with: {
      stripeCustomer: {
        with: { client: { with: { clientPortalAccesses: true } } },
      },
    },
  });
  const foundInvoice = rawInvoice
    ? { ...rawInvoice, stripeCustomer: rawInvoice.stripeCustomer ? { ...rawInvoice.stripeCustomer, client: rawInvoice.stripeCustomer.client ? { ...rawInvoice.stripeCustomer.client, portalAccess: (rawInvoice.stripeCustomer.client as any).clientPortalAccesses?.[0] ?? null } : null } : null }
    : null;

  if (foundInvoice) {
    await db.update(invoice).set({
      status: foundInvoice.dueDate && new Date() > new Date(foundInvoice.dueDate) ? 'OVERDUE' : 'PENDING',
      updatedAt: new Date().toISOString(),
    }).where(eq(invoice.id, foundInvoice.id));

    // ── Portal lock logic ──────────────────────────────────────────────────
    const client = (foundInvoice.stripeCustomer as any)?.client;
    if (client?.portalAccess && client.portalAccess.status === 'ACTIVE') {
      await db.update(clientPortalAccess).set({
        status: 'LOCKED',
        lockedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(clientPortalAccess.clientId, client.id));
      console.log(`🔒 [Portal] Locked for client: ${client.name} — payment failed`);

      // Send lock notification to client
      await sendPortalLockedEmail(client.name, client.email);
    }
    // ──────────────────────────────────────────────────────────────────────

    const clientName = (foundInvoice.stripeCustomer as any)?.client?.companyName ||
                       (foundInvoice.stripeCustomer as any)?.client?.name ||
                       'Client';
    const clientEmail = (foundInvoice.stripeCustomer as any)?.client?.email || stripeInvoice.customer_email;

    await sendPaymentNotificationEmail({
      type: 'payment_failed',
      invoiceNumber: foundInvoice.invoiceNumber,
      clientName,
      clientEmail: clientEmail || 'N/A',
      amount: stripeInvoice.amount_due / 100,
      invoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      failureReason: 'Payment was declined or failed to process',
    });
  }

  } finally {
    await closeDb();
  }
}

async function handleInvoiceFinalized(stripeInvoice: Stripe.Invoice) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`📄 Stripe Invoice finalized: ${stripeInvoice.id}`);

  const invoiceRow = await db.query.invoice.findFirst({
    where: eq(invoice.stripeInvoiceId, stripeInvoice.id),
    with: {
      stripeCustomer: {
        with: {
          client: true,
        },
      },
    },
  });

  if (invoiceRow) {
    await db.update(invoice).set({
      stripeHostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
      stripePdfUrl: stripeInvoice.invoice_pdf,
      status: 'SENT',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(invoice.id, invoiceRow.id));

    // Instant lock: any invoice being sent locks that client's portal right
    // away, rather than waiting for a grace period / due date to pass. This
    // also naturally clears any prior ADMIN_UNLOCKED bypass — the moment a
    // new invoice goes out, normal locking rules apply again. Unlocking
    // happens automatically via the invoice.paid handler below.
    // const clientId = invoice.stripeCustomer?.clientId;
    // const alreadyPaid = (stripeInvoice.amount_remaining ?? stripeInvoice.amount_due) <= 0;
    // if (clientId && !alreadyPaid) {
    //   try {
    //     await prisma.clientPortalAccess.upsert({
    //       where: { clientId },
    //       update: {
    //         status: 'LOCKED',
    //         lockedAt: new Date(),
    //         adminUnlockedById: null,
    //         adminUnlockedAt: null,
    //       },
    //       create: {
    //         clientId,
    //         status: 'LOCKED',
    //         lockedAt: new Date(),
    //       },
    //     });
    //     console.log(`🔒 [Invoice Finalized] Locked portal for client: ${invoice.stripeCustomer?.client?.name || clientId}`);
    //   } catch (lockErr: any) {
    //     console.error(`Failed to lock portal for client ${clientId}:`, lockErr.message);
    //   }
    // }

    // Send CC notification to payments@e8productions.com
    const clientName = invoiceRow.stripeCustomer?.client?.companyName ||
                       invoiceRow.stripeCustomer?.client?.name ||
                       'Client';
    const clientEmail = invoiceRow.stripeCustomer?.client?.email || stripeInvoice.customer_email;

    console.log(`📧 Invoice ${invoiceRow.invoiceNumber} sent to ${clientEmail}`);

    // Send notification email to payments@e8productions.com
    await sendPaymentNotificationEmail({
      type: 'invoice_sent',
      invoiceNumber: invoiceRow.invoiceNumber,
      clientName,
      clientEmail: clientEmail || 'N/A',
      amount: stripeInvoice.amount_due / 100,
      invoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      pdfUrl: stripeInvoice.invoice_pdf || undefined,
    });
  }

  } finally {
    await closeDb();
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`🔄 Subscription created: ${subscription.id}`);

  const [stripeCustomer] = await db.select().from(stripeCustomerTable).where(eq(stripeCustomerTable.stripeCustomerId, subscription.customer as string)).limit(1);

  if (!stripeCustomer) {
    console.error('No StripeCustomer found for:', subscription.customer);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const amount = subscription.items.data[0]?.price.unit_amount || 0;

  await db.insert(subscriptionTable).values({
    id: createId(),
    stripeCustomerId: stripeCustomer.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    status: mapSubscriptionStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    amount,
    currency: subscription.currency,
    interval: subscription.items.data[0]?.price.recurring?.interval || 'month',
    updatedAt: new Date().toISOString(),
  });

  if (subscription.metadata?.type === 'storage_upgrade') {
    await applyStorageUpgrade(subscription.metadata.clientId, subscription.metadata.addBytes);
  }

  } finally {
    await closeDb();
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`🔄 Subscription updated: ${subscription.id}`);

  const [existing] = await db.select().from(subscriptionTable).where(eq(subscriptionTable.stripeSubscriptionId, subscription.id)).limit(1);

  if (!existing) {
    // If doesn't exist, create it
    await handleSubscriptionCreated(subscription);
    return;
  }

  await db.update(subscriptionTable).set({
    status: mapSubscriptionStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    updatedAt: new Date().toISOString(),
  }).where(eq(subscriptionTable.stripeSubscriptionId, subscription.id));

  } finally {
    await closeDb();
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`🗑️ Subscription deleted: ${subscription.id}`);

  await db.update(subscriptionTable).set({
    status: 'CANCELED',
    canceledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(subscriptionTable.stripeSubscriptionId, subscription.id));

  } finally {
    await closeDb();
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`✅ Checkout completed: ${session.id}`);

  const { invoiceId, type } = session.metadata || {};

  if (type === 'invoice_payment' && invoiceId) {
    // Update invoice status. Tech Fees are captured in payment_intent.succeeded
    // to avoid double-queuing the same fee from both events.
    await db.update(invoice).set({
      status: 'PAID',
      paidAt: new Date().toISOString(),
      stripePaymentIntentId: session.payment_intent as string,
      updatedAt: new Date().toISOString(),
    }).where(eq(invoice.id, invoiceId));

    const rawInvoice = await db.query.invoice.findFirst({
      where: eq(invoice.id, invoiceId),
      with: {
        stripeCustomer: {
          with: { client: { with: { clientPortalAccesses: true } } },
        },
      },
    });
    const portalAccess = (rawInvoice as any)?.stripeCustomer?.client?.clientPortalAccesses?.[0];
    const clientId = (rawInvoice as any)?.stripeCustomer?.clientId;
    if (portalAccess && clientId) {
      const updateData = portalUnlockUpdate({
        autoInvoiceActive: !!portalAccess.autoInvoiceActive,
        existingNextBillingDate: portalAccess.nextBillingDate,
        billingAnchorDate: portalAccess.billingAnchorDate,
        manuallyLocked: portalAccess.status === 'LOCKED' && !!portalAccess.adminUnlockedById,
      });
      await db.update(clientPortalAccess).set(updateData).where(eq(clientPortalAccess.clientId, clientId));
      console.log(`🔓 [Portal] Unlocked via Checkout for invoice ${invoiceId}`);
    }
  }

  } finally {
    await closeDb();
  }
}

async function applyStorageUpgrade(clientId?: string, addBytes?: string) {
  const { db, closeDb } = getDbPool();
  try {
  if (!clientId || !addBytes) return;

  const [client] = await db.select({ rawFootageStorageLimit: clientTable.rawFootageStorageLimit })
    .from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

  if (!client) return;

  const currentLimit = BigInt(client.rawFootageStorageLimit?.toString() || '3298534883328');
  const addedStorage = BigInt(addBytes);

  await db.update(clientTable).set({
    rawFootageStorageLimit: Number(currentLimit + addedStorage),
    storageAlert90Sent: false,
    storageAlert95Sent: false,
    updatedAt: new Date().toISOString(),
  }).where(eq(clientTable.id, clientId));

  } finally {
    await closeDb();
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`💳 Payment method attached: ${paymentMethod.id}`);

  const customerId = paymentMethod.customer as string;
  const [stripeCustomer] = await db.select().from(stripeCustomerTable).where(eq(stripeCustomerTable.stripeCustomerId, customerId)).limit(1);

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

  await db.insert(paymentMethodTable).values({
    id: createId(),
    ...data,
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: paymentMethodTable.stripePaymentMethodId,
    set: { ...data, updatedAt: new Date().toISOString() },
  });

  } finally {
    await closeDb();
  }
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  const { db, closeDb } = getDbPool();
  try {
  console.log(`💳 Payment method detached: ${paymentMethod.id}`);

  await db.delete(paymentMethodTable).where(eq(paymentMethodTable.stripePaymentMethodId, paymentMethod.id)).catch(() => {
    // Ignore if doesn't exist
  });

  } finally {
    await closeDb();
  }
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

// ── Portal pipeline helpers ────────────────────────────────────────────────────

// Handles first payment via Stripe Checkout (no invoice record yet in our DB)
async function handleFirstCheckoutPayment(stripeInvoice: Stripe.Invoice) {
  const { db, closeDb } = getDbPool();
  try {
  const stripeCustomerId = stripeInvoice.customer as string;
  if (!stripeCustomerId) return;

  const rawStripeCustomer = await db.query.stripeCustomer.findFirst({
    where: eq(stripeCustomerTable.stripeCustomerId, stripeCustomerId),
    with: { client: { with: { clientPortalAccesses: true } } },
  });

  if (!rawStripeCustomer) return;
  const client = rawStripeCustomer.client
    ? { ...rawStripeCustomer.client, portalAccess: (rawStripeCustomer.client as any).clientPortalAccesses?.[0] ?? null }
    : null;
  if (!client?.portalAccess) return;
  const stripeCustomer = rawStripeCustomer;

  const now = new Date();

  // Create Invoice record so it shows in admin + client billing pages
  const [createdInvoice] = await db.insert(invoice).values({
    id: createId(),
    stripeCustomerId: stripeCustomer.id,
    stripeInvoiceId: stripeInvoice.id,
    invoiceNumber: stripeInvoice.number || generateInvoiceNumber(),
    status: 'PAID',
    amount: stripeInvoice.amount_due,
    amountPaid: stripeInvoice.amount_paid,
    currency: stripeInvoice.currency || 'usd',
    paidAt: now.toISOString(),
    isRecurring: true,
    stripeHostedInvoiceUrl: stripeInvoice.hosted_invoice_url || null,
    stripePdfUrl: stripeInvoice.invoice_pdf || null,
    stripePaymentIntentId: stripeInvoice.payment_intent as string | null,
    lineItems: [
      {
        description: `Monthly Service — ${client.companyName || client.name}`,
        quantity: 1,
        unitPrice: stripeInvoice.amount_due,
        total: stripeInvoice.amount_due,
      },
    ],
    description: `Monthly retainer — ${client.companyName || client.name}`,
    sentAt: now.toISOString(),
    metadata: stripeInvoice.metadata || undefined,
    updatedAt: now.toISOString(),
  }).returning();

  // Create Payment record
  if (stripeInvoice.payment_intent) {
    await db.insert(payment).values({
      id: createId(),
      invoiceId: createdInvoice.id,
      stripePaymentIntentId: stripeInvoice.payment_intent as string,
      amount: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency || 'usd',
      status: 'SUCCEEDED',
      paymentMethod: 'card',
      updatedAt: now.toISOString(),
    });
  }

  // Unlock portal — preserve auto-invoice schedule if already configured
  const updateData = portalUnlockUpdate({
    autoInvoiceActive: !!client.portalAccess.autoInvoiceActive,
    existingNextBillingDate: client.portalAccess.nextBillingDate,
    billingAnchorDate: client.portalAccess.billingAnchorDate,
        manuallyLocked: client.portalAccess.status === 'LOCKED' && !!client.portalAccess.adminUnlockedById,
    now,
  });
  // First-time onboarding without auto-invoice still needs a nextBillingDate
  if (!updateData.nextBillingDate && !client.portalAccess.autoInvoiceActive) {
    updateData.nextBillingDate = advanceOneCalendarMonth(now).toISOString();
  }

  await db.update(clientPortalAccess).set(updateData).where(eq(clientPortalAccess.clientId, client.id));

  console.log(`🔓 [Portal] First payment — unlocked for: ${client.name}, invoice: ${createdInvoice.invoiceNumber}`);

  } finally {
    await closeDb();
  }
}

// Send billing warning email 3 days before billing date
export async function sendBillingWarningEmail(clientName: string, clientEmail: string, billingDate: Date) {
  const { createTransporter } = await import('@/lib/mail-transport');
  const { renderEmailShell } = await import('@/lib/email-shell');
  const transporter = createTransporter();

  const dateStr = billingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';

  const contentHtml = `
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Your payment is due on ${dateStr}</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${clientName},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Just a heads-up — your monthly payment is due on <strong>${dateStr}</strong>. Your portal will remain active as long as payment is received on time. If payment fails, access will be temporarily suspended until it's resolved.</td></tr>
      <tr><td class="px" align="center" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${baseUrl}/dashboard" style="display:block;padding:12px 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Go to My Portal</a>
        </td></tr></table>
      </td></tr>`;

  await transporter.sendMail({
    from: `"E8 Productions" <eric@e8productions.com>`,
    to: clientEmail,
    subject: `Your E8 payment is due on ${dateStr}`,
    html: renderEmailShell({ previewText: 'Your E8 payment is coming up.', contentHtml }),
  }).catch(console.error);
}

// Send portal locked email when payment fails
async function sendPortalLockedEmail(clientName: string, clientEmail: string) {
  const { createTransporter } = await import('@/lib/mail-transport');
  const { renderEmailShell } = await import('@/lib/email-shell');
  const transporter = createTransporter();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';

  const contentHtml = `
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Action required — your portal has been suspended</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${clientName},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">We weren't able to process your monthly payment, so your portal access has been temporarily suspended. To restore access, please log in and complete your payment:</td></tr>
      <tr><td class="px" align="center" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${baseUrl}/dashboard" style="display:block;padding:12px 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Complete Payment</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">If you have any questions, reply to this email or contact us directly.</td></tr>`;

  await transporter.sendMail({
    from: `"E8 Productions" <eric@e8productions.com>`,
    to: clientEmail,
    subject: `Action required — Your E8 portal has been suspended`,
    html: renderEmailShell({ previewText: 'Your E8 portal has been suspended.', contentHtml }),
  }).catch(console.error);
}