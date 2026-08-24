export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  client as clientTable,
  clientPortalAccess as clientPortalAccessTable,
  stripeCustomer as stripeCustomerTable,
  invoice as invoiceTable,
} from '@/lib/db/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { portalUnlockUpdate } from '@/lib/auto-invoice';

// GET /api/portal/verify-payment
// Unlocks the portal when the client has an active Stripe subscription OR
// has paid outstanding invoices (auto-invoice path).
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db.query.client.findFirst({
      where: or(eq(clientTable.userId, user.id), eq(clientTable.email, user.email)),
      with: { clientPortalAccesses: true },
    });

    const portalAccess = client?.clientPortalAccesses[0];

    if (!client || !portalAccess) {
      return NextResponse.json({ error: 'Client or portal access not found' }, { status: 404 });
    }

    if (portalAccess.status === 'ACTIVE') {
      return NextResponse.json({ success: true, status: 'ACTIVE', message: 'Already active' });
    }

    const [stripeCustomer] = await db
      .select()
      .from(stripeCustomerTable)
      .where(eq(stripeCustomerTable.clientId, client.id))
      .limit(1);

    if (!stripeCustomer) {
      return NextResponse.json({ success: false, message: 'No Stripe customer found' });
    }

    let shouldUnlock = false;
    let unlockReason = '';

    // Path 1: active Stripe subscription (onboarding / subscription clients)
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.stripeCustomerId,
      status: 'active',
      limit: 1,
    });
    if (subscriptions.data.length > 0) {
      shouldUnlock = true;
      unlockReason = 'active subscription';
    }

    // Path 2: auto-invoice / invoice clients — unlock if no overdue and at least one paid
    if (!shouldUnlock) {
      const overdue = await db
        .select({ id: invoiceTable.id })
        .from(invoiceTable)
        .where(and(
          eq(invoiceTable.stripeCustomerId, stripeCustomer.id),
          inArray(invoiceTable.status, ['OVERDUE', 'PENDING', 'SENT']),
        ))
        .limit(1);

      const [paid] = await db
        .select({ id: invoiceTable.id })
        .from(invoiceTable)
        .where(and(
          eq(invoiceTable.stripeCustomerId, stripeCustomer.id),
          eq(invoiceTable.status, 'PAID'),
        ))
        .limit(1);

      // Also check Stripe for open invoices
      let hasOpenStripeInvoice = false;
      try {
        const openInvoices = await stripe.invoices.list({
          customer: stripeCustomer.stripeCustomerId,
          status: 'open',
          limit: 5,
        });
        hasOpenStripeInvoice = openInvoices.data.some((inv) => {
          if (!inv.due_date) return true;
          return inv.due_date * 1000 < Date.now();
        });
      } catch {
        // ignore Stripe lookup failures
      }

      if (paid && overdue.length === 0 && !hasOpenStripeInvoice) {
        shouldUnlock = true;
        unlockReason = 'invoices paid';
      }

      // Soft unlock for LOCKED clients when their most recent open invoice was just paid in Stripe
      if (!shouldUnlock && (portalAccess.status === 'LOCKED' || portalAccess.status === 'ADMIN_UNLOCKED' || portalAccess.status === 'PAYMENT_PENDING')) {
        try {
          const recentPaid = await stripe.invoices.list({
            customer: stripeCustomer.stripeCustomerId,
            status: 'paid',
            limit: 3,
          });
          const paidRecently = recentPaid.data.some(
            (inv) => inv.status_transitions?.paid_at && inv.status_transitions.paid_at * 1000 > Date.now() - 7 * 24 * 60 * 60 * 1000
          );
          const openNow = await stripe.invoices.list({
            customer: stripeCustomer.stripeCustomerId,
            status: 'open',
            limit: 5,
          });
          const anyPastDueOpen = openNow.data.some((inv) => inv.due_date && inv.due_date * 1000 < Date.now());
          if (paidRecently && !anyPastDueOpen) {
            shouldUnlock = true;
            unlockReason = 'recent Stripe invoice payment';
          }
        } catch {
          // ignore
        }
      }
    }

    if (shouldUnlock) {
      const updateData = portalUnlockUpdate({
        autoInvoiceActive: !!portalAccess.autoInvoiceActive,
        existingNextBillingDate: portalAccess.nextBillingDate,
        billingAnchorDate: portalAccess.billingAnchorDate,
      });

      await db.update(clientPortalAccessTable).set(updateData).where(eq(clientPortalAccessTable.clientId, client.id));

      console.log(`🔓 [Portal] Manual Verification — unlocked for: ${client.name} (${unlockReason})`);
      return NextResponse.json({ success: true, status: 'ACTIVE', reason: unlockReason });
    }

    return NextResponse.json({
      success: false,
      status: portalAccess.status,
      message: 'No active subscription or cleared invoices found',
    });
  } catch (err: any) {
    console.error('GET /api/portal/verify-payment error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
