// src/lib/billing-sync.ts
//
// Pulls each given Stripe customer's invoices/subscriptions back into the
// local DB and updates portal lock state accordingly — the actual
// reconciliation logic behind both:
//   - the manual "Sync & Refresh" button (GET /api/billing/sync)
//   - the automatic hourly safety-net (POST /api/cron/billing-sync)
//
// Previously this only ran when someone clicked the button. Webhooks handle
// the real-time updates, so in practice this is a safety net for anything a
// webhook missed — which is exactly the kind of thing nobody remembers to
// click a button for. Extracted here so both call sites run the identical
// logic instead of two copies drifting apart.

import { getDbHttp } from '@/lib/db';
import { invoice, subscription, clientPortalAccess } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, count as countFn } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

type StripeCustomerRow = {
  id: string;
  clientId: string;
  stripeCustomerId: string;
  client?: { name?: string | null } | null;
};

export async function syncStripeCustomers(
  db: ReturnType<typeof getDbHttp>,
  stripeCustomersToSync: StripeCustomerRow[]
): Promise<{ invoicesSynced: number; subscriptionsSynced: number }> {
  let invoicesSynced = 0;
  let subscriptionsSynced = 0;

  for (const customer of stripeCustomersToSync) {
    try {
      // 1. Sync Invoices from Stripe
      const stripeInvoices = await stripe.invoices.list({
        customer: customer.stripeCustomerId,
        limit: 100,
      });

      for (const stripeInv of stripeInvoices.data) {
        const [existingInvoice] = await db.select().from(invoice).where(eq(invoice.stripeInvoiceId, stripeInv.id)).limit(1);

        let localStatus: any = 'SENT';
        if (stripeInv.status === 'open') {
          localStatus = stripeInv.due_date && Date.now() > stripeInv.due_date * 1000 ? 'OVERDUE' : 'SENT';
        } else if (stripeInv.status === 'draft') {
          localStatus = 'DRAFT';
        } else if (stripeInv.status === 'paid') {
          localStatus = 'PAID';
        } else if (stripeInv.status === 'uncollectible' || stripeInv.status === 'void') {
          localStatus = 'CANCELED';
        }

        const lineItems = stripeInv.lines.data.map(line => ({
          description: line.description || 'Line Item',
          amount: line.amount,
          quantity: line.quantity || 1,
        }));

        const invoiceData = {
          stripeCustomerId: customer.id,
          stripeInvoiceId: stripeInv.id,
          invoiceNumber: stripeInv.number || stripeInv.id,
          status: localStatus,
          amount: stripeInv.amount_due || stripeInv.total || 0,
          amountPaid: stripeInv.amount_paid || 0,
          currency: stripeInv.currency || 'usd',
          dueDate: (stripeInv.due_date ? new Date(stripeInv.due_date * 1000) : new Date((stripeInv.created + 30 * 24 * 60 * 60) * 1000)).toISOString(),
          paidAt: stripeInv.status_transitions?.paid_at ? new Date(stripeInv.status_transitions.paid_at * 1000).toISOString() : null,
          sentAt: stripeInv.status_transitions?.finalized_at ? new Date(stripeInv.status_transitions.finalized_at * 1000).toISOString() : null,
          description: stripeInv.description,
          lineItems: lineItems,
          stripeHostedInvoiceUrl: stripeInv.hosted_invoice_url,
          stripePdfUrl: stripeInv.invoice_pdf,
          isRecurring: !!stripeInv.subscription || stripeInv.metadata?.invoiceType === 'RECURRING',
          stripePaymentIntentId: stripeInv.payment_intent as string | null,
          metadata: stripeInv.metadata && Object.keys(stripeInv.metadata).length > 0
            ? stripeInv.metadata
            : undefined,
        };

        if (existingInvoice) {
          await db.update(invoice).set({
            status: invoiceData.status,
            amountPaid: invoiceData.amountPaid,
            paidAt: invoiceData.paidAt,
            stripeHostedInvoiceUrl: invoiceData.stripeHostedInvoiceUrl,
            stripePdfUrl: invoiceData.stripePdfUrl,
            amount: invoiceData.amount,
            sentAt: invoiceData.sentAt,
            dueDate: invoiceData.dueDate,
            stripePaymentIntentId: invoiceData.stripePaymentIntentId,
            ...(invoiceData.metadata ? { metadata: invoiceData.metadata } : {}),
            updatedAt: new Date().toISOString(),
          }).where(eq(invoice.id, existingInvoice.id));
        } else {
          let invoiceByNumber = null;
          if (stripeInv.number) {
            [invoiceByNumber] = await db.select().from(invoice).where(eq(invoice.invoiceNumber, stripeInv.number)).limit(1);
          }
          if (invoiceByNumber) {
            await db.update(invoice).set({
              stripeInvoiceId: stripeInv.id,
              status: invoiceData.status,
              amountPaid: invoiceData.amountPaid,
              paidAt: invoiceData.paidAt,
              stripeHostedInvoiceUrl: invoiceData.stripeHostedInvoiceUrl,
              stripePdfUrl: invoiceData.stripePdfUrl,
              stripePaymentIntentId: invoiceData.stripePaymentIntentId,
              ...(invoiceData.metadata ? { metadata: invoiceData.metadata } : {}),
              updatedAt: new Date().toISOString(),
            }).where(eq(invoice.id, invoiceByNumber.id));
          } else {
            await db.insert(invoice).values({
              id: createId(),
              ...invoiceData,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        invoicesSynced++;
      }

      // 2. Sync Subscriptions from Stripe
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: customer.stripeCustomerId,
        limit: 100,
      });

      for (const stripeSub of stripeSubscriptions.data) {
        const [existingSub] = await db.select().from(subscription).where(eq(subscription.stripeSubscriptionId, stripeSub.id)).limit(1);

        const mapSubscriptionStatus = (status: string) => {
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
        };

        const localStatus = mapSubscriptionStatus(stripeSub.status);
        const priceId = stripeSub.items.data[0]?.price.id;
        const amount = stripeSub.items.data[0]?.price.unit_amount || 0;
        const interval = stripeSub.items.data[0]?.price.recurring?.interval || 'month';

        const subscriptionData = {
          stripeCustomerId: customer.id,
          stripeSubscriptionId: stripeSub.id,
          stripePriceId: priceId,
          status: localStatus,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000).toISOString() : null,
          amount,
          currency: stripeSub.currency || 'usd',
          interval,
        };

        if (existingSub) {
          await db.update(subscription).set({
            status: subscriptionData.status,
            currentPeriodStart: subscriptionData.currentPeriodStart,
            currentPeriodEnd: subscriptionData.currentPeriodEnd,
            cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
            canceledAt: subscriptionData.canceledAt,
            amount: subscriptionData.amount,
            updatedAt: new Date().toISOString(),
          }).where(eq(subscription.id, existingSub.id));
        } else {
          await db.insert(subscription).values({
            id: createId(),
            ...subscriptionData,
            updatedAt: new Date().toISOString(),
          });
        }
        subscriptionsSynced++;
      }

      // 3. Update Portal Lock State
      const [portalAccess] = await db.select().from(clientPortalAccess).where(eq(clientPortalAccess.clientId, customer.clientId)).limit(1);

      if (portalAccess) {
        const [{ value: overdueInvoicesCount }] = await db.select({ value: countFn() }).from(invoice).where(and(
          eq(invoice.stripeCustomerId, customer.id),
          eq(invoice.status, 'OVERDUE'),
        ));

        const [{ value: hasPastDueSubscriptions }] = await db.select({ value: countFn() }).from(subscription).where(and(
          eq(subscription.stripeCustomerId, customer.id),
          eq(subscription.status, 'PAST_DUE'),
        ));

        const now = new Date();
        let shouldLock = overdueInvoicesCount > 0 || hasPastDueSubscriptions > 0;

        const adminUnlockExempt = portalAccess.status === 'ADMIN_UNLOCKED'
          && portalAccess.adminUnlockedAt
          && new Date(portalAccess.adminUnlockedAt) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (shouldLock && portalAccess.status !== 'LOCKED' && !adminUnlockExempt) {
          await db.update(clientPortalAccess).set({
            status: 'LOCKED',
            lockedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }).where(eq(clientPortalAccess.clientId, customer.clientId));
          console.log(`[Stripe Sync] Locked portal for client: ${customer.client?.name}`);
        } else if (!shouldLock && portalAccess.status === 'LOCKED') {
          const unlockData: Record<string, unknown> = {
            status: 'ACTIVE',
            lockedAt: null,
            updatedAt: now.toISOString(),
          };
          if (!portalAccess.autoInvoiceActive) {
            const nextBilling = new Date(now);
            nextBilling.setMonth(nextBilling.getMonth() + 1);
            unlockData.nextBillingDate = nextBilling.toISOString();
          }
          await db.update(clientPortalAccess).set(unlockData).where(eq(clientPortalAccess.clientId, customer.clientId));
          console.log(`[Stripe Sync] Unlocked portal for client: ${customer.client?.name}`);
        }
      }
    } catch (err: any) {
      console.error(`Error syncing customer ${customer.id}:`, err);
    }
  }

  return { invoicesSynced, subscriptionsSynced };
}