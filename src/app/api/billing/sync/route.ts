export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { stripeCustomer, invoice, subscription, clientPortalAccess } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray, count as countFn } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = ['admin', 'manager'].includes(user.role?.toLowerCase() ?? '');
    
    // Determine which clients to sync
    let stripeCustomersToSync = [];
    
    const { searchParams } = new URL(req.url);
    const clientIdParam = searchParams.get('clientId');
    
    if (isAdmin) {
      if (clientIdParam) {
        // Sync specific client
        const customer = await db.query.stripeCustomer.findFirst({
          where: eq(stripeCustomer.clientId, clientIdParam),
          with: { client: true }
        });
        if (customer) stripeCustomersToSync.push(customer);
      } else {
        // Sync ALL clients
        stripeCustomersToSync = await db.query.stripeCustomer.findMany({
          with: { client: true }
        });
      }
    } else {
      // Client role - only sync their own client ID
      const effectiveClientId = await resolveClientIdForUser(user.id);
      if (!effectiveClientId) {
        return NextResponse.json({ success: true, message: 'No client profile associated with this user.' });
      }

      const customer = await db.query.stripeCustomer.findFirst({
        where: eq(stripeCustomer.clientId, effectiveClientId),
        with: { client: true }
      });
      if (customer) stripeCustomersToSync.push(customer);
    }
    
    console.log(`[Stripe Sync] Syncing Stripe data for ${stripeCustomersToSync.length} customer(s)...`);
    
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
          // Check if invoice already exists by stripeInvoiceId
          const [existingInvoice] = await db.select().from(invoice).where(eq(invoice.stripeInvoiceId, stripeInv.id)).limit(1);
          
          let localStatus: any = 'SENT';
          if (stripeInv.status === 'open') {
            if (stripeInv.due_date && Date.now() > stripeInv.due_date * 1000) {
              localStatus = 'OVERDUE';
            } else {
              localStatus = 'SENT';
            }
          } else if (stripeInv.status === 'draft') {
            localStatus = 'DRAFT';
          } else if (stripeInv.status === 'paid') {
            localStatus = 'PAID';
          } else if (stripeInv.status === 'uncollectible' || stripeInv.status === 'void') {
            localStatus = 'CANCELED';
          }
          
          // Map line items to standard JSON format
          const lineItems = stripeInv.lines.data.map(line => ({
            description: line.description || 'Line Item',
            amount: line.amount, // in cents
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
            // Check if there is an invoice with the same invoiceNumber (created locally before stripeInvoiceId was set)
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
          // Check if there are overdue invoices or unpaid active subscriptions
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

          // Admin-unlocked clients get one billing period's grace before the
          // sync job is allowed to re-lock them for an overdue invoice.
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
            // Auto unlock if everything is clean. Preserve auto-invoice schedule.
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
    
    return NextResponse.json({
      success: true,
      invoicesSynced,
      subscriptionsSynced,
      message: `Successfully synced ${invoicesSynced} invoice(s) and ${subscriptionsSynced} subscription(s).`
    });
    
  } catch (err: any) {
    console.error('[Stripe Sync] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
