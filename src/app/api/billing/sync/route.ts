export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
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
        const customer = await prisma.stripeCustomer.findUnique({
          where: { clientId: clientIdParam },
          include: { client: true }
        });
        if (customer) stripeCustomersToSync.push(customer);
      } else {
        // Sync ALL clients
        stripeCustomersToSync = await prisma.stripeCustomer.findMany({
          include: { client: true }
        });
      }
    } else {
      // Client role - only sync their own client ID
      // Retrieve their linkedClientId
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { linkedClientId: true }
      });
      
      const effectiveClientId = userRecord?.linkedClientId;
      if (!effectiveClientId) {
        return NextResponse.json({ success: true, message: 'No client profile associated with this user.' });
      }
      
      const customer = await prisma.stripeCustomer.findUnique({
        where: { clientId: effectiveClientId },
        include: { client: true }
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
          const existingInvoice = await prisma.invoice.findUnique({
            where: { stripeInvoiceId: stripeInv.id },
          });
          
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
            dueDate: stripeInv.due_date ? new Date(stripeInv.due_date * 1000) : new Date((stripeInv.created + 30 * 24 * 60 * 60) * 1000),
            paidAt: stripeInv.status_transitions?.paid_at ? new Date(stripeInv.status_transitions.paid_at * 1000) : null,
            sentAt: stripeInv.status_transitions?.finalized_at ? new Date(stripeInv.status_transitions.finalized_at * 1000) : null,
            description: stripeInv.description,
            lineItems: lineItems,
            stripeHostedInvoiceUrl: stripeInv.hosted_invoice_url,
            stripePdfUrl: stripeInv.invoice_pdf,
            isRecurring: !!stripeInv.subscription,
            stripePaymentIntentId: stripeInv.payment_intent as string | null,
          };
          
          if (existingInvoice) {
            await prisma.invoice.update({
              where: { id: existingInvoice.id },
              data: {
                status: invoiceData.status,
                amountPaid: invoiceData.amountPaid,
                paidAt: invoiceData.paidAt,
                stripeHostedInvoiceUrl: invoiceData.stripeHostedInvoiceUrl,
                stripePdfUrl: invoiceData.stripePdfUrl,
                amount: invoiceData.amount,
                sentAt: invoiceData.sentAt,
                dueDate: invoiceData.dueDate,
                stripePaymentIntentId: invoiceData.stripePaymentIntentId,
              }
            });
          } else {
            // Check if there is an invoice with the same invoiceNumber (created locally before stripeInvoiceId was set)
            let invoiceByNumber = null;
            if (stripeInv.number) {
              invoiceByNumber = await prisma.invoice.findFirst({
                where: { invoiceNumber: stripeInv.number },
              });
            }
            if (invoiceByNumber) {
              await prisma.invoice.update({
                where: { id: invoiceByNumber.id },
                data: {
                  stripeInvoiceId: stripeInv.id,
                  status: invoiceData.status,
                  amountPaid: invoiceData.amountPaid,
                  paidAt: invoiceData.paidAt,
                  stripeHostedInvoiceUrl: invoiceData.stripeHostedInvoiceUrl,
                  stripePdfUrl: invoiceData.stripePdfUrl,
                  stripePaymentIntentId: invoiceData.stripePaymentIntentId,
                }
              });
            } else {
              await prisma.invoice.create({
                data: invoiceData,
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
          const existingSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: stripeSub.id },
          });
          
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
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
            amount,
            currency: stripeSub.currency || 'usd',
            interval,
          };
          
          if (existingSub) {
            await prisma.subscription.update({
              where: { id: existingSub.id },
              data: {
                status: subscriptionData.status,
                currentPeriodStart: subscriptionData.currentPeriodStart,
                currentPeriodEnd: subscriptionData.currentPeriodEnd,
                cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
                canceledAt: subscriptionData.canceledAt,
                amount: subscriptionData.amount,
              }
            });
          } else {
            await prisma.subscription.create({
              data: subscriptionData,
            });
          }
          subscriptionsSynced++;
        }
        
        // 3. Update Portal Lock State
        const portalAccess = await prisma.clientPortalAccess.findUnique({
          where: { clientId: customer.clientId }
        });
        
        if (portalAccess) {
          // Check if there are overdue invoices or unpaid active subscriptions
          const overdueInvoicesCount = await prisma.invoice.count({
            where: {
              stripeCustomerId: customer.id,
              status: 'OVERDUE',
            }
          });
          
          const activeSubscriptions = await prisma.subscription.findMany({
            where: {
              stripeCustomerId: customer.id,
              status: { in: ['ACTIVE', 'TRIALING'] }
            }
          });
          
          const hasPastDueSubscriptions = await prisma.subscription.count({
            where: {
              stripeCustomerId: customer.id,
              status: 'PAST_DUE'
            }
          });
          
          const now = new Date();
          let shouldLock = overdueInvoicesCount > 0 || hasPastDueSubscriptions > 0;
          
          if (shouldLock && portalAccess.status !== 'LOCKED') {
            await prisma.clientPortalAccess.update({
              where: { clientId: customer.clientId },
              data: {
                status: 'LOCKED',
                lockedAt: now,
              }
            });
            console.log(`[Stripe Sync] Locked portal for client: ${customer.client?.name}`);
          } else if (!shouldLock && portalAccess.status === 'LOCKED') {
            // Auto unlock if everything is clean and they have a subscription
            const nextBilling = new Date(now);
            nextBilling.setMonth(nextBilling.getMonth() + 1);
            
            await prisma.clientPortalAccess.update({
              where: { clientId: customer.clientId },
              data: {
                status: 'ACTIVE',
                lockedAt: null,
                nextBillingDate: nextBilling,
              }
            });
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
