export const dynamic = 'force-dynamic';

// src/app/api/finance/monthly-compliance/route.ts
//
// One row per auto-invoice client for a given calendar month, answering
// "did this client get billed, and did they pay?" — the gap the plain
// invoice list doesn't close on its own, since it only shows invoices that
// exist and doesn't surface a client who was silently never invoiced at all
// (e.g. the auto-invoice cron failing to run for a day).
//
// complianceStatus per client, in priority order:
//   SKIPPED_SUBSCRIPTION — client has a live Stripe subscription; auto-invoice
//     deliberately skips these (see /api/cron/auto-invoice), so there's
//     nothing to flag here — they're billed a different way.
//   NOT_DUE_YET — their nextBillingDate falls in a later month than the one
//     being viewed; nothing should have happened yet.
//   PAID / LOCKED / OVERDUE / SENT — an invoice exists for this month;
//     status reflects the invoice + current portal lock state directly.
//   NOT_INVOICED — nextBillingDate for this month has already passed and no
//     invoice exists for it — this is the one that should never happen and
//     is the main thing this view exists to catch (auto-invoice cron
//     silently not running, portal access misconfigured, etc).

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  clientPortalAccess as clientPortalAccessTable,
  client as clientTable,
  stripeCustomer as stripeCustomerTable,
  invoice as invoiceTable,
  subscription as subscriptionTable,
} from '@/lib/db/schema';
import { and, eq, gte, lt, inArray } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

type ComplianceStatus =
  | 'PAID'
  | 'LOCKED'
  | 'OVERDUE'
  | 'SENT'
  | 'NOT_INVOICED'
  | 'NOT_DUE_YET'
  | 'SKIPPED_SUBSCRIPTION';

interface ComplianceRow {
  clientId: string;
  clientName: string;
  complianceStatus: ComplianceStatus;
  recurringAmount: number | null;
  nextBillingDate: string | null;
  portalStatus: string;
  invoice: {
    id: string;
    status: string;
    amount: number;
    amountPaid: number;
    sentAt: string | null;
    dueDate: string | null;
    paidAt: string | null;
  } | null;
}

/** YYYY-MM-01T00:00:00Z .. next month's YYYY-MM-01T00:00:00Z, for a "YYYY-MM" input. */
function monthRange(monthParam: string | null): { start: Date; end: Date; label: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    year = Number(monthParam.slice(0, 4));
    month = Number(monthParam.slice(5, 7)) - 1;
  }

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const label = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { start, end, label };
}

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const { start, end, label } = monthRange(searchParams.get('month'));

    // Every client that's supposed to be billed automatically each month.
    const accessRows = await db
      .select({
        clientId: clientPortalAccessTable.clientId,
        status: clientPortalAccessTable.status,
        nextBillingDate: clientPortalAccessTable.nextBillingDate,
        recurringAmount: clientPortalAccessTable.recurringAmount,
        clientName: clientTable.companyName,
        clientNameFallback: clientTable.name,
      })
      .from(clientPortalAccessTable)
      .innerJoin(clientTable, eq(clientTable.id, clientPortalAccessTable.clientId))
      .where(eq(clientPortalAccessTable.autoInvoiceActive, true));

    if (accessRows.length === 0) {
      return NextResponse.json({ ok: true, month: label, rows: [], summary: {} });
    }

    const clientIds = accessRows.map((r) => r.clientId);

    // stripeCustomer rows for these clients (invoices/subscriptions key off
    // stripeCustomerId, not clientId directly).
    const stripeCustomers = await db
      .select({ id: stripeCustomerTable.id, clientId: stripeCustomerTable.clientId })
      .from(stripeCustomerTable)
      .where(inArray(stripeCustomerTable.clientId, clientIds));
    const stripeCustomerIdByClientId = new Map(stripeCustomers.map((c) => [c.clientId, c.id]));
    const stripeCustomerIds = stripeCustomers.map((c) => c.id);

    // Live subscriptions among these customers — auto-invoice skips anyone
    // on one of these, so they're excluded from the "should be invoiced"
    // logic entirely rather than flagged NOT_INVOICED.
    const liveSubs = stripeCustomerIds.length
      ? await db
          .select({ stripeCustomerId: subscriptionTable.stripeCustomerId })
          .from(subscriptionTable)
          .where(and(
            inArray(subscriptionTable.stripeCustomerId, stripeCustomerIds),
            inArray(subscriptionTable.status, ['ACTIVE', 'TRIALING', 'PAST_DUE']),
          ))
      : [];
    const liveSubCustomerIds = new Set(liveSubs.map((s) => s.stripeCustomerId));

    // Recurring invoices sent within the requested month, for these customers.
    const monthInvoices = stripeCustomerIds.length
      ? await db
          .select({
            id: invoiceTable.id,
            stripeCustomerId: invoiceTable.stripeCustomerId,
            status: invoiceTable.status,
            amount: invoiceTable.amount,
            amountPaid: invoiceTable.amountPaid,
            sentAt: invoiceTable.sentAt,
            dueDate: invoiceTable.dueDate,
            paidAt: invoiceTable.paidAt,
          })
          .from(invoiceTable)
          .where(and(
            inArray(invoiceTable.stripeCustomerId, stripeCustomerIds),
            eq(invoiceTable.isRecurring, true),
            gte(invoiceTable.sentAt, start.toISOString()),
            lt(invoiceTable.sentAt, end.toISOString()),
          ))
      : [];
    const invoiceByCustomerId = new Map(monthInvoices.map((inv) => [inv.stripeCustomerId, inv]));

    const rows: ComplianceRow[] = accessRows.map((access) => {
      const clientName = access.clientName || access.clientNameFallback || access.clientId;
      const stripeCustomerId = stripeCustomerIdByClientId.get(access.clientId);
      const isOnLiveSubscription = stripeCustomerId ? liveSubCustomerIds.has(stripeCustomerId) : false;
      const monthInvoice = stripeCustomerId ? invoiceByCustomerId.get(stripeCustomerId) : undefined;

      let complianceStatus: ComplianceStatus;

      if (isOnLiveSubscription) {
        complianceStatus = 'SKIPPED_SUBSCRIPTION';
      } else if (monthInvoice) {
        if (monthInvoice.status === 'PAID') {
          complianceStatus = 'PAID';
        } else if (access.status === 'LOCKED') {
          complianceStatus = 'LOCKED';
        } else if (monthInvoice.status === 'OVERDUE') {
          complianceStatus = 'OVERDUE';
        } else {
          complianceStatus = 'SENT';
        }
      } else {
        // No invoice for this month yet — fine if their billing date
        // hasn't arrived, a real problem if it has.
        const nbd = access.nextBillingDate ? new Date(access.nextBillingDate) : null;
        complianceStatus = nbd && nbd >= end ? 'NOT_DUE_YET' : 'NOT_INVOICED';
      }

      return {
        clientId: access.clientId,
        clientName,
        complianceStatus,
        recurringAmount: access.recurringAmount,
        nextBillingDate: access.nextBillingDate,
        portalStatus: access.status,
        invoice: monthInvoice
          ? {
              id: monthInvoice.id,
              status: monthInvoice.status,
              amount: monthInvoice.amount,
              amountPaid: monthInvoice.amountPaid,
              sentAt: monthInvoice.sentAt,
              dueDate: monthInvoice.dueDate,
              paidAt: monthInvoice.paidAt,
            }
          : null,
      };
    });

    rows.sort((a, b) => a.clientName.localeCompare(b.clientName));

    const summary = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.complianceStatus] = (acc[r.complianceStatus] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ ok: true, month: label, rows, summary });
  } catch (err: any) {
    console.error('[monthly-compliance] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
