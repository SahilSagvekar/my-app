export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { stripe, constructWebhookEvent, STRIPE_WEBHOOK_EVENTS, generateInvoiceNumber } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { sendPaymentNotificationEmail } from '@/lib/email';

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
    include: {
      stripeCustomer: {
        include: { client: { include: { portalAccess: true } } },
      },
    },
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

    // ── Portal unlock logic ────────────────────────────────────────────────
    const client = (invoice.stripeCustomer as any)?.client;
    if (client?.portalAccess) {
      const portalAccess = client.portalAccess;
      const now = new Date();

      // Compute next billing date (same calendar day next month)
      const nextBilling = new Date(now);
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      const updateData: any = {
        status: 'ACTIVE',
        lockedAt: null,
        adminUnlockedById: null,
        adminUnlockedAt: null,
        nextBillingDate: nextBilling,
      };

      // Set billing anchor on first payment
      if (!portalAccess.billingAnchorDate) {
        updateData.billingAnchorDate = now;
      }

      await prisma.clientPortalAccess.update({
        where: { clientId: client.id },
        data: updateData,
      });

      console.log(`🔓 [Portal] Unlocked for client: ${client.name} | next billing: ${nextBilling.toISOString()}`);
    }
    // ──────────────────────────────────────────────────────────────────────

    // Also handle invoice paid for checkout session (first payment via Stripe Checkout)
    // The stripeCustomer may be resolved via Stripe metadata if no invoice record exists yet
    const clientName = (invoice.stripeCustomer as any)?.client?.companyName || 
                       (invoice.stripeCustomer as any)?.client?.name || 
                       'Client';
    const clientEmail = (invoice.stripeCustomer as any)?.client?.email || stripeInvoice.customer_email;

    await sendPaymentNotificationEmail({
      type: 'invoice_paid',
      invoiceNumber: invoice.invoiceNumber,
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
}

async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  console.log(`❌ Stripe Invoice payment failed: ${stripeInvoice.id}`);

  const invoice = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
    include: {
      stripeCustomer: {
        include: { client: { include: { portalAccess: true } } },
      },
    },
  });

  if (invoice) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.dueDate && new Date() > invoice.dueDate ? 'OVERDUE' : 'PENDING',
      },
    });

    // ── Portal lock logic ──────────────────────────────────────────────────
    const client = (invoice.stripeCustomer as any)?.client;
    if (client?.portalAccess && client.portalAccess.status === 'ACTIVE') {
      await prisma.clientPortalAccess.update({
        where: { clientId: client.id },
        data: {
          status: 'LOCKED',
          lockedAt: new Date(),
        },
      });
      console.log(`🔒 [Portal] Locked for client: ${client.name} — payment failed`);

      // Send lock notification to client
      await sendPortalLockedEmail(client.name, client.email);
    }
    // ──────────────────────────────────────────────────────────────────────

    const clientName = (invoice.stripeCustomer as any)?.client?.companyName || 
                       (invoice.stripeCustomer as any)?.client?.name || 
                       'Client';
    const clientEmail = (invoice.stripeCustomer as any)?.client?.email || stripeInvoice.customer_email;

    await sendPaymentNotificationEmail({
      type: 'payment_failed',
      invoiceNumber: invoice.invoiceNumber,
      clientName,
      clientEmail: clientEmail || 'N/A',
      amount: stripeInvoice.amount_due / 100,
      invoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      failureReason: 'Payment was declined or failed to process',
    });
  }
}

async function handleInvoiceFinalized(stripeInvoice: Stripe.Invoice) {
  console.log(`📄 Stripe Invoice finalized: ${stripeInvoice.id}`);

  const invoice = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
    include: {
      stripeCustomer: {
        include: {
          client: true,
        },
      },
    },
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

    // Send CC notification to payments@e8productions.com
    const clientName = invoice.stripeCustomer?.client?.companyName || 
                       invoice.stripeCustomer?.client?.name || 
                       'Client';
    const clientEmail = invoice.stripeCustomer?.client?.email || stripeInvoice.customer_email;
    
    console.log(`📧 Invoice ${invoice.invoiceNumber} sent to ${clientEmail}`);
    
    // Send notification email to payments@e8productions.com
    await sendPaymentNotificationEmail({
      type: 'invoice_sent',
      invoiceNumber: invoice.invoiceNumber,
      clientName,
      clientEmail: clientEmail || 'N/A',
      amount: stripeInvoice.amount_due / 100,
      invoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      pdfUrl: stripeInvoice.invoice_pdf || undefined,
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

  if (subscription.metadata?.type === 'storage_upgrade') {
    await applyStorageUpgrade(subscription.metadata.clientId, subscription.metadata.addBytes);
  }
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

async function applyStorageUpgrade(clientId?: string, addBytes?: string) {
  if (!clientId || !addBytes) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { rawFootageStorageLimit: true },
  });

  if (!client) return;

  const currentLimit = BigInt(client.rawFootageStorageLimit?.toString() || '3298534883328');
  const addedStorage = BigInt(addBytes);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      rawFootageStorageLimit: currentLimit + addedStorage,
      storageAlert90Sent: false,
      storageAlert95Sent: false,
    },
  });
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

// ── Portal pipeline helpers ────────────────────────────────────────────────────

// Handles first payment via Stripe Checkout (no invoice record yet in our DB)
async function handleFirstCheckoutPayment(stripeInvoice: Stripe.Invoice) {
  const stripeCustomerId = stripeInvoice.customer as string;
  if (!stripeCustomerId) return;

  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { stripeCustomerId },
    include: { client: { include: { portalAccess: true } } },
  });

  if (!stripeCustomer) return;
  const client = (stripeCustomer as any)?.client;
  if (!client?.portalAccess) return;

  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  // Create Invoice record so it shows in admin + client billing pages
  const invoice = await prisma.invoice.create({
    data: {
      stripeCustomerId: stripeCustomer.id,
      stripeInvoiceId: stripeInvoice.id,
      invoiceNumber: stripeInvoice.number || generateInvoiceNumber(),
      status: 'PAID',
      amount: stripeInvoice.amount_due,
      amountPaid: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency || 'usd',
      paidAt: now,
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
      sentAt: now,
    },
  });

  // Create Payment record
  if (stripeInvoice.payment_intent) {
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        stripePaymentIntentId: stripeInvoice.payment_intent as string,
        amount: stripeInvoice.amount_paid,
        currency: stripeInvoice.currency || 'usd',
        status: 'SUCCEEDED',
        paymentMethod: 'card',
      },
    });
  }

  // Unlock portal
  const updateData: any = {
    status: 'ACTIVE',
    lockedAt: null,
    nextBillingDate: nextBilling,
  };

  if (!client.portalAccess.billingAnchorDate) {
    updateData.billingAnchorDate = now;
  }

  await prisma.clientPortalAccess.update({
    where: { clientId: client.id },
    data: updateData,
  });

  console.log(`🔓 [Portal] First payment — unlocked for: ${client.name}, invoice: ${invoice.invoiceNumber}`);
}

// Send billing warning email 3 days before billing date
export async function sendBillingWarningEmail(clientName: string, clientEmail: string, billingDate: Date) {
  const nodemailer = await import('nodemailer');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = nodemailer.default.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const dateStr = billingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';

  await transporter.sendMail({
    from: `"E8 Productions" <eric@e8productions.com>`,
    to: clientEmail,
    subject: `Your E8 payment is due on ${dateStr}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
        <div style="border-bottom: 3px solid #0066ff; padding-bottom: 12px; margin-bottom: 20px;">
          <strong style="font-size: 18px;">E8 Productions</strong>
        </div>
        <p>Hi ${clientName},</p>
        <p>Just a heads-up — your monthly payment is due on <strong>${dateStr}</strong>.</p>
        <p>Your portal will remain active as long as payment is received on time.
           If payment fails, access will be temporarily suspended until it's resolved.</p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${baseUrl}/dashboard"
             style="background: #0066ff; color: #fff; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold;">
            Go to My Portal
          </a>
        </div>
        <p style="font-size: 12px; color: #999;">
          E8 Productions, LLC · <a href="https://e8productions.com">e8productions.com</a>
        </p>
      </div>
    `,
  }).catch(console.error);
}

// Send portal locked email when payment fails
async function sendPortalLockedEmail(clientName: string, clientEmail: string) {
  const nodemailer = await import('nodemailer');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = nodemailer.default.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';

  await transporter.sendMail({
    from: `"E8 Productions" <eric@e8productions.com>`,
    to: clientEmail,
    subject: `Action required — Your E8 portal has been suspended`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
        <div style="border-bottom: 3px solid #e53e3e; padding-bottom: 12px; margin-bottom: 20px;">
          <strong style="font-size: 18px; color: #e53e3e;">E8 Productions</strong>
        </div>
        <p>Hi ${clientName},</p>
        <p>We weren't able to process your monthly payment, so your portal access has been
           temporarily suspended.</p>
        <p>To restore access, please log in and complete your payment:</p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${baseUrl}/dashboard"
             style="background: #e53e3e; color: #fff; padding: 12px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: bold;">
            Complete Payment
          </a>
        </div>
        <p>If you have any questions, reply to this email or contact us directly.</p>
        <p style="font-size: 12px; color: #999;">
          E8 Productions, LLC · <a href="https://e8productions.com">e8productions.com</a>
        </p>
      </div>
    `,
  }).catch(console.error);
}
