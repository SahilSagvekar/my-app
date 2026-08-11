// src/app/api/cron/enforce-portal-locks/route.ts
// Daily job: the time-driven half of the existing lock system. billing/sync
// already knows how to lock/unlock a portal based on overdue invoices — it
// just only ever ran when an admin manually hit that endpoint. This job:
//   1. Flags any SENT/PENDING invoice past its dueDate as OVERDUE (keeps the
//      status label accurate for anyone viewing the invoice list).
//   2. Locks the portal for any client with an incomplete invoice past due —
//      checked directly (status not PAID/CANCELED/REFUNDED/DRAFT), not just
//      the OVERDUE label, so a partial payment that's still short still locks.
// Unlocking on payment already happens via the Stripe webhook (invoice.paid),
// so that path is untouched — this job only ever locks or leaves things alone.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import {
  clientPortalAccess as clientPortalAccessTable,
  invoice as invoiceTable,
  stripeCustomer as stripeCustomerTable,
} from '@/lib/db/schema';
import { and, eq, exists, inArray, lt, notInArray } from 'drizzle-orm';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  try {
    // 1. Flag newly-overdue invoices
    const overdueResult = await db.update(invoiceTable).set({
      status: 'OVERDUE',
      updatedAt: new Date().toISOString(),
    }).where(and(
      inArray(invoiceTable.status, ['SENT', 'PENDING']),
      lt(invoiceTable.dueDate, now.toISOString()),
    )).returning({ id: invoiceTable.id });

    // 2. Find every client with at least one incomplete (unpaid/partially-paid)
    // invoice past its due date — checked directly, not via the OVERDUE label,
    // so this also catches anything the flagging step above missed or that
    // was created with a status this job doesn't manage.
    const overdueCustomers = await db.query.stripeCustomer.findMany({
      where: exists(
        db
          .select({ id: invoiceTable.id })
          .from(invoiceTable)
          .where(and(
            eq(invoiceTable.stripeCustomerId, stripeCustomerTable.id),
            lt(invoiceTable.dueDate, now.toISOString()),
            notInArray(invoiceTable.status, ['PAID', 'CANCELED', 'REFUNDED', 'DRAFT']),
          ))
      ),
      columns: { id: true, clientId: true },
      with: { client: { columns: { name: true, companyName: true } } },
    });

    const results: Array<{ clientId: string; status: 'locked' | 'skipped'; reason?: string }> = [];

    for (const customer of overdueCustomers) {
      const [portalAccess] = await db
        .select()
        .from(clientPortalAccessTable)
        .where(eq(clientPortalAccessTable.clientId, customer.clientId))
        .limit(1);

      if (!portalAccess) {
        results.push({ clientId: customer.clientId, status: 'skipped', reason: 'no portal access record' });
        continue;
      }

      if (portalAccess.status === 'LOCKED') {
        results.push({ clientId: customer.clientId, status: 'skipped', reason: 'already locked' });
        continue;
      }

      // Admin-unlocked clients get one billing period's grace before this
      // job is allowed to re-lock them — mirrors the existing billing/sync rule.
      const adminUnlockExempt =
        portalAccess.status === 'ADMIN_UNLOCKED' &&
        portalAccess.adminUnlockedAt &&
        new Date(portalAccess.adminUnlockedAt) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (adminUnlockExempt) {
        results.push({ clientId: customer.clientId, status: 'skipped', reason: 'admin-unlock grace period' });
        continue;
      }

      await db.update(clientPortalAccessTable).set({
        status: 'LOCKED',
        lockedAt: now.toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(clientPortalAccessTable.clientId, customer.clientId));

      console.log(
        `[enforce-portal-locks] Locked portal for client: ${customer.client?.companyName || customer.client?.name}`
      );
      results.push({ clientId: customer.clientId, status: 'locked' });
    }

    const locked = results.filter((r) => r.status === 'locked').length;

    return NextResponse.json({
      ok: true,
      message: `Flagged ${overdueResult.length} invoice(s) OVERDUE, locked ${locked} portal(s)`,
      results,
    });
  } catch (err: any) {
    console.error('[enforce-portal-locks] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}