export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { stripeCustomer } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { syncStripeCustomers } from '@/lib/billing-sync';

// Manual "Sync & Refresh" button. The actual reconciliation logic lives in
// syncStripeCustomers (src/lib/billing-sync.ts) — this route just resolves
// which customer(s) the requester is allowed to sync and calls it. The same
// logic now also runs automatically every hour (see
// /api/cron/billing-sync), so this button is a manual force-refresh, not
// the only way sync happens anymore.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = ['admin', 'manager'].includes(user.role?.toLowerCase() ?? '');

    let stripeCustomersToSync = [];

    const { searchParams } = new URL(req.url);
    const clientIdParam = searchParams.get('clientId');

    if (isAdmin) {
      if (clientIdParam) {
        const customer = await db.query.stripeCustomer.findFirst({
          where: eq(stripeCustomer.clientId, clientIdParam),
          with: { client: true }
        });
        if (customer) stripeCustomersToSync.push(customer);
      } else {
        stripeCustomersToSync = await db.query.stripeCustomer.findMany({
          with: { client: true }
        });
      }
    } else {
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

    const { invoicesSynced, subscriptionsSynced } = await syncStripeCustomers(db, stripeCustomersToSync as any);

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