import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Helper to format amount for display (cents to dollars)
export function formatAmount(amountInCents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

// Helper to convert dollars to cents
export function toCents(dollars: number | string): number {
  const parsed = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (isNaN(parsed) || parsed < 0) {
    console.warn('toCents received invalid value:', dollars);
    return 0;
  }
  return Math.round(parsed * 100);
}

// Helper to convert cents to dollars
export function toDollars(cents: number): number {
  return cents / 100;
}

// Generate a unique invoice number
export function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Stripe event types we handle
export const STRIPE_WEBHOOK_EVENTS = {
  // Payment Intent events
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  
  // Invoice events
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_FINALIZED: 'invoice.finalized',
  INVOICE_SENT: 'invoice.sent',
  
  // Subscription events
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  
  // Payment method events
  PAYMENT_METHOD_ATTACHED: 'payment_method.attached',
  PAYMENT_METHOD_DETACHED: 'payment_method.detached',
  
  // Checkout events
  CHECKOUT_COMPLETED: 'checkout.session.completed',
  CHECKOUT_EXPIRED: 'checkout.session.expired',
} as const;

// Create or get Stripe customer for a client
export async function getOrCreateStripeCustomer(
  clientId: string,
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const { prisma } = await import('@/lib/prisma');
  
  // Check if customer already exists
  const existingCustomer = await prisma.stripeCustomer.findUnique({
    where: { clientId },
  });
  
  if (existingCustomer) {
    // Return existing Stripe customer
    const customer = await stripe.customers.retrieve(existingCustomer.stripeCustomerId);
    if (customer.deleted) {
      // Customer was deleted in Stripe, create a new one
      await prisma.stripeCustomer.delete({ where: { clientId } });
    } else {
      return customer as Stripe.Customer;
    }
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      clientId,
      ...metadata,
    },
  });
  
  // Save to database
  await prisma.stripeCustomer.create({
    data: {
      clientId,
      stripeCustomerId: customer.id,
      currency: 'usd',
    },
  });
  
  return customer;
}

// Create a payment intent for one-time payment
export async function createPaymentIntent(
  customerId: string,
  amount: number, // in cents
  currency: string = 'usd',
  paymentMethodTypes: string[] = ['card', 'us_bank_account'],
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    customer: customerId,
    amount,
    currency,
    payment_method_types: paymentMethodTypes,
    metadata,
  });
}

// Create a checkout session for invoice payment
export async function createInvoiceCheckoutSession(
  customerId: string,
  invoiceId: string,
  amount: number,
  description: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card', 'us_bank_account'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: description || 'Invoice Payment',
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId,
      type: 'invoice_payment',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

// Create a subscription checkout session
export async function createSubscriptionCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card', 'us_bank_account'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

// Create a Stripe invoice
export async function createStripeInvoice(
  customerId: string,
  lineItems: Array<{ description: string; amount: number; quantity?: number }>,
  daysUntilDue: number = 30,
  metadata?: Record<string, string>,
  invoiceDescription?: string
): Promise<Stripe.Invoice> {
  console.log('🔵 Creating Stripe invoice for customer:', customerId);
  console.log('🔵 Line items:', JSON.stringify(lineItems));
  console.log('🔵 Invoice description:', invoiceDescription);
  
  // First create the invoice (in draft state)
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue,
    metadata,
    description: invoiceDescription || undefined, // Invoice-level description shown to customer
    auto_advance: false, // Don't auto-finalize, we'll do it manually after adding items
  });
  
  console.log('🔵 Created draft invoice:', invoice.id);
  
  // Add invoice items TO THIS SPECIFIC INVOICE
  for (const item of lineItems) {
    if (item.amount <= 0) {
      console.warn('⚠️ Skipping line item with zero/negative amount:', item);
      continue;
    }
    
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id, // <-- THIS IS THE KEY FIX: attach to specific invoice
      amount: item.amount,
      currency: 'usd',
      description: item.description,
    });
    
    console.log('🔵 Added invoice item:', invoiceItem.id, 'amount:', item.amount);
  }
  
  // Retrieve the updated invoice with items
  const updatedInvoice = await stripe.invoices.retrieve(invoice.id);
  console.log('🔵 Invoice total after adding items:', updatedInvoice.amount_due);
  
  return updatedInvoice;
}

// Send a Stripe invoice
export async function sendStripeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  // Finalize and send
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  return stripe.invoices.sendInvoice(finalizedInvoice.id);
}

// Cancel a subscription
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  return stripe.subscriptions.cancel(subscriptionId);
}

// Get customer's payment methods
export async function getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  const cardMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  
  const bankMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'us_bank_account',
  });
  
  return [...cardMethods.data, ...bankMethods.data];
}

// Attach a payment method to customer
export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
}

// Set default payment method
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  return stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

// Create a billing portal session for customer self-service
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}