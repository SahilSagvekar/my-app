export const dynamic = 'force-dynamic';

// POST /api/finance/financials2/client-payments/manual
// Record a payment received outside Stripe (cash, check, Zelle, wire…).
// Body: { clientId, amount (dollars), method, receivedAt "YYYY-MM-DD",
//         invoiceId?, reference?, notes? }
// Admin only. Counts toward revenue in the month it was received.

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import {
  client as clientTable,
  invoice as invoiceTable,
  stripeCustomer as stripeCustomerTable,
  clientManualPayment as manualTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { getManualPaidByInvoice, num } from '@/lib/finance/client-payments';

const METHODS = ['CASH', 'CHECK', 'ZELLE', 'WIRE', 'OTHER'] as const;
const MAX_DOLLARS = 10_000_000;

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck || !currentUser) {
      return NextResponse.json({ ok: false, message: adminCheck?.error ?? 'Unauthorized' }, { status: adminCheck?.status ?? 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });

    const { clientId, invoiceId, method, receivedAt } = body;
    const amountDollars = Number(body.amount);
    const reference = typeof body.reference === 'string' ? body.reference.trim().slice(0, 200) || null : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null;

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json({ ok: false, message: 'Client is required' }, { status: 400 });
    }
    if (!METHODS.includes(method)) {
      return NextResponse.json({ ok: false, message: 'Choose a valid payment method' }, { status: 400 });
    }
    if (!Number.isFinite(amountDollars) || amountDollars <= 0 || amountDollars > MAX_DOLLARS) {
      return NextResponse.json({ ok: false, message: 'Enter an amount greater than 0' }, { status: 400 });
    }
    if (typeof receivedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt) || Number.isNaN(Date.parse(receivedAt))) {
      return NextResponse.json({ ok: false, message: 'Enter the date the payment was received' }, { status: 400 });
    }
    const amountCents = Math.round(amountDollars * 100);
    // Noon UTC so the date can never slip into a neighbouring month.
    const receivedIso = `${receivedAt}T12:00:00.000Z`;

    const [clientRow] = await db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.id, clientId)).limit(1);
    if (!clientRow) return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });

    if (invoiceId) {
      const [inv] = await db
        .select({
          id: invoiceTable.id,
          status: invoiceTable.status,
          amount: invoiceTable.amount,
          amountPaid: invoiceTable.amountPaid,
          clientId: stripeCustomerTable.clientId,
        })
        .from(invoiceTable)
        .leftJoin(stripeCustomerTable, eq(invoiceTable.stripeCustomerId, stripeCustomerTable.id))
        .where(eq(invoiceTable.id, invoiceId))
        .limit(1);

      if (!inv) return NextResponse.json({ ok: false, message: 'Invoice not found' }, { status: 404 });
      if (inv.clientId !== clientId) {
        return NextResponse.json({ ok: false, message: 'That invoice belongs to a different client' }, { status: 400 });
      }
      if (['DRAFT', 'CANCELED', 'REFUNDED'].includes(inv.status)) {
        return NextResponse.json({ ok: false, message: `Can't apply a payment to a ${inv.status.toLowerCase()} invoice` }, { status: 400 });
      }
      const manual = await getManualPaidByInvoice(db, [inv.id]);
      const balance = num(inv.amount) - num(inv.amountPaid) - (manual.get(inv.id) ?? 0);
      if (amountCents > balance) {
        return NextResponse.json(
          { ok: false, message: `Amount is more than the invoice's remaining balance ($${(Math.max(balance, 0) / 100).toFixed(2)})` },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const [created] = await db
      .insert(manualTable)
      .values({
        id: createId(),
        clientId,
        invoiceId: invoiceId || null,
        amount: amountCents,
        method,
        receivedAt: receivedIso,
        reference,
        notes,
        createdById: Number(currentUser.id) || null,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ ok: true, payment: created }, { status: 201 });
  } catch (err: any) {
    console.error('[financials2/client-payments/manual POST]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
