export const dynamic = 'force-dynamic';

// GET /api/finance/financials2/client-payments/open-invoices?clientId=...
// Invoices for one client that still have a balance, across ALL months —
// feeds the optional "apply to invoice" picker in the Add manual payment form.

import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { invoice as invoiceTable, stripeCustomer as stripeCustomerTable } from '@/lib/db/schema';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { getManualPaidByInvoice, num } from '@/lib/finance/client-payments';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const clientId = new URL(req.url).searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ ok: false, message: 'clientId is required' }, { status: 400 });

    const rows = await db
      .select({
        id: invoiceTable.id,
        invoiceNumber: invoiceTable.invoiceNumber,
        amount: invoiceTable.amount,
        amountPaid: invoiceTable.amountPaid,
        dueDate: invoiceTable.dueDate,
      })
      .from(invoiceTable)
      .innerJoin(stripeCustomerTable, eq(invoiceTable.stripeCustomerId, stripeCustomerTable.id))
      .where(and(
        eq(stripeCustomerTable.clientId, clientId),
        notInArray(invoiceTable.status, ['DRAFT', 'CANCELED', 'REFUNDED', 'PAID']),
      ))
      .orderBy(asc(invoiceTable.dueDate));

    const manual = await getManualPaidByInvoice(db, rows.map((r) => r.id));
    const invoices = rows
      .map((r) => {
        const balanceCents = num(r.amount) - num(r.amountPaid) - (manual.get(r.id) ?? 0);
        return { id: r.id, invoiceNumber: r.invoiceNumber, amountCents: num(r.amount), balanceCents, dueDate: r.dueDate };
      })
      .filter((r) => r.balanceCents > 0);

    return NextResponse.json({ ok: true, invoices });
  } catch (err: any) {
    console.error('[financials2/client-payments/open-invoices]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
