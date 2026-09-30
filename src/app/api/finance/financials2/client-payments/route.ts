export const dynamic = 'force-dynamic';

// GET /api/finance/financials2/client-payments?month=YYYY-MM
//
// Everything the expanded Client Payments page needs in one call:
//   - months:  cash received per month for the last 12 months (Stripe + manual)
//   - summary: the selected month's revenue, invoiced and outstanding totals
//   - invoices: invoices due in the selected month (falls back to the created
//     date when an invoice has no due date), with manual payments folded in
//   - manualPayments: manual payments received in the selected month
//   - clients: id/name list for the "Add manual payment" form
// Admin only. Amounts are cents. See src/lib/finance/client-payments.ts for
// how revenue is defined.

import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, gte, lt, ne, sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import {
  invoice as invoiceTable,
  stripeCustomer as stripeCustomerTable,
  client as clientTable,
  user as userTable,
  clientManualPayment as manualTable,
} from '@/lib/db/schema';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import {
  NON_REVENUE_INVOICE_STATUSES,
  effectiveInvoiceStatus,
  getManualPaidByInvoice,
  getRevenueByMonth,
  monthBounds,
  num,
  toMonthKey,
} from '@/lib/finance/client-payments';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const { start, end, label } = monthBounds(searchParams.get('month'));
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // Last 12 months ending with the current month, plus the selected month
    // if it is older than that window.
    const now = new Date();
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const windowStart = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() - 11, 1));
    const seriesStart = start < windowStart ? start : windowStart;
    const seriesEnd = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() + 1, 1));
    const seriesEndFinal = end > seriesEnd ? end : seriesEnd;

    const dueOrCreated = sql`coalesce(${invoiceTable.dueDate}, ${invoiceTable.createdAt})`;

    const [revenueByMonth, invoiceRows, manualRows, clientRows] = await Promise.all([
      getRevenueByMonth(db, seriesStart.toISOString(), seriesEndFinal.toISOString()),

      db
        .select({
          id: invoiceTable.id,
          invoiceNumber: invoiceTable.invoiceNumber,
          rawStatus: invoiceTable.status,
          amount: invoiceTable.amount,
          amountPaid: invoiceTable.amountPaid,
          dueDate: invoiceTable.dueDate,
          paidAt: invoiceTable.paidAt,
          createdAt: invoiceTable.createdAt,
          description: invoiceTable.description,
          hostedUrl: invoiceTable.stripeHostedInvoiceUrl,
          clientId: clientTable.id,
          clientName: clientTable.name,
          clientCompany: clientTable.companyName,
        })
        .from(invoiceTable)
        .leftJoin(stripeCustomerTable, eq(invoiceTable.stripeCustomerId, stripeCustomerTable.id))
        .leftJoin(clientTable, eq(stripeCustomerTable.clientId, clientTable.id))
        .where(and(
          sql`${dueOrCreated} >= ${startIso}`,
          sql`${dueOrCreated} < ${endIso}`,
          ne(invoiceTable.status, 'DRAFT'),
        ))
        .orderBy(asc(dueOrCreated)),

      db
        .select({
          id: manualTable.id,
          clientId: manualTable.clientId,
          clientName: clientTable.name,
          clientCompany: clientTable.companyName,
          invoiceId: manualTable.invoiceId,
          invoiceNumber: invoiceTable.invoiceNumber,
          amount: manualTable.amount,
          method: manualTable.method,
          receivedAt: manualTable.receivedAt,
          reference: manualTable.reference,
          notes: manualTable.notes,
          createdByName: userTable.name,
          voidedAt: manualTable.voidedAt,
          voidReason: manualTable.voidReason,
        })
        .from(manualTable)
        .leftJoin(clientTable, eq(manualTable.clientId, clientTable.id))
        .leftJoin(invoiceTable, eq(manualTable.invoiceId, invoiceTable.id))
        .leftJoin(userTable, eq(manualTable.createdById, userTable.id))
        .where(and(gte(manualTable.receivedAt, startIso), lt(manualTable.receivedAt, endIso)))
        .orderBy(desc(manualTable.receivedAt)),

      db
        .select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
        .from(clientTable)
        .orderBy(asc(clientTable.name)),
    ]);

    // ---- Monthly revenue series (oldest → newest) ----
    const months: { month: string; stripeCents: number; manualCents: number; totalCents: number }[] = [];
    for (let d = new Date(seriesStart); d < seriesEndFinal; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const key = toMonthKey(d);
      const r = revenueByMonth.get(key) ?? { stripeCents: 0, manualCents: 0 };
      months.push({ month: key, ...r, totalCents: r.stripeCents + r.manualCents });
    }
    const selected = revenueByMonth.get(label) ?? { stripeCents: 0, manualCents: 0 };

    // ---- Invoices, with manual payments folded in ----
    const manualByInvoice = await getManualPaidByInvoice(db, invoiceRows.map((i) => i.id));
    let invoicedCents = 0;
    let outstandingCents = 0;
    const invoices = invoiceRows.map((inv) => {
      const amount = num(inv.amount);
      const stripePaidCents = num(inv.amountPaid);
      const manualPaidCents = manualByInvoice.get(inv.id) ?? 0;
      const paidCents = stripePaidCents + manualPaidCents;
      const status = effectiveInvoiceStatus(inv.rawStatus, amount, paidCents);
      const counts = !(NON_REVENUE_INVOICE_STATUSES as readonly string[]).includes(inv.rawStatus);
      if (counts) {
        invoicedCents += amount;
        outstandingCents += Math.max(0, amount - paidCents);
      }
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        clientName: inv.clientCompany || inv.clientName || 'Unknown client',
        description: inv.description,
        status,
        rawStatus: inv.rawStatus,
        amountCents: amount,
        stripePaidCents,
        manualPaidCents,
        paidCents,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        hostedUrl: inv.hostedUrl,
      };
    });

    const manualPayments = manualRows.map((m) => ({
      id: m.id,
      clientId: m.clientId,
      clientName: m.clientCompany || m.clientName || 'Unknown client',
      invoiceId: m.invoiceId,
      invoiceNumber: m.invoiceNumber,
      amountCents: num(m.amount),
      method: m.method,
      receivedAt: m.receivedAt,
      reference: m.reference,
      notes: m.notes,
      createdByName: m.createdByName,
      voidedAt: m.voidedAt,
      voidReason: m.voidReason,
    }));

    return NextResponse.json({
      ok: true,
      month: label,
      summary: {
        stripeCents: selected.stripeCents,
        manualCents: selected.manualCents,
        totalCents: selected.stripeCents + selected.manualCents,
        invoicedCents,
        outstandingCents,
      },
      months,
      invoices,
      manualPayments,
      clients: clientRows.map((c) => ({ id: c.id, name: c.companyName || c.name })),
    });
  } catch (err: any) {
    console.error('[financials2/client-payments GET]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
