export const dynamic = 'force-dynamic';

// POST /api/clients/[id]/expense-trips/[tripId]/invoice
// Body: { expenseIds: string[] }
//
// Batches the selected PENDING expenses (must all belong to this trip) into
// one real Stripe invoice — one line item per expense, exact amount, no
// markup — and emails it to the client immediately. Reuses the same
// createStripeInvoice/sendStripeInvoice + local Invoice-table pattern as
// auto-invoice, tagged isRecurring: false so it's correctly excluded from
// the Monthly Compliance view (that's recurring-billing-only by design).
//
// Money-critical (writes a real invoice + updates expense state together),
// so this uses the transaction pool like the other 11 payment-writing
// routes, not the plain HTTP driver.

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { expenseTrip, clientExpense, client as clientTable, invoice as invoiceTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { getOrCreateStripeCustomer, createStripeInvoice, sendStripeInvoice, generateInvoiceNumber } from '@/lib/stripe';

const DAYS_UNTIL_DUE = 15; // formal due date shown on the invoice — note the
// portal-lock cron ignores this and locks 1 day after sending regardless.

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; tripId: string }> }) {
  const { db, closeDb } = getDbPool();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { id: clientId, tripId } = await context.params;
    const body = await req.json();
    const expenseIds: string[] = Array.isArray(body?.expenseIds) ? body.expenseIds : [];

    if (expenseIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one expense to invoice' }, { status: 400 });
    }

    const [trip] = await db.select().from(expenseTrip).where(eq(expenseTrip.id, tripId)).limit(1);
    if (!trip || trip.clientId !== clientId) {
      return NextResponse.json({ error: 'Trip not found for this client' }, { status: 404 });
    }

    const [dbClient] = await db.select().from(clientTable).where(eq(clientTable.id, clientId)).limit(1);
    if (!dbClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const expenses = await db
      .select()
      .from(clientExpense)
      .where(and(inArray(clientExpense.id, expenseIds), eq(clientExpense.tripId, tripId)));

    if (expenses.length !== expenseIds.length) {
      return NextResponse.json({ error: 'One or more expenses were not found in this trip' }, { status: 400 });
    }
    const nonPending = expenses.filter((e) => e.status !== 'PENDING');
    if (nonPending.length > 0) {
      return NextResponse.json({ error: 'One or more selected expenses are already invoiced' }, { status: 400 });
    }

    // Stripe calls happen before the DB transaction below — Stripe has no
    // rollback of its own, so if something after this point fails, we'd
    // rather have a real Stripe invoice with no local record (recoverable
    // by checking Stripe directly) than a local record pointing at an
    // invoice that was never actually created/sent.
    const stripeCustomer = await getOrCreateStripeCustomer(clientId, dbClient.email, dbClient.companyName || dbClient.name);

    const lineItems = expenses.map((e) => ({ description: e.description, amount: e.amount }));
    // Stripe idempotency prevents a network retry from issuing the same
    // selected receipts as a second invoice.
    const idempotencyKey = `expense:${tripId}:${[...expenseIds].sort().join(':')}`;
    const draftInvoice = await createStripeInvoice(
      stripeCustomer.id,
      lineItems,
      DAYS_UNTIL_DUE,
      { invoiceType: 'EXPENSE', tripId },
      `Expense reimbursement — ${trip.name}`,
      idempotencyKey
    );
    const sentInvoice = await sendStripeInvoice(draftInvoice.id);

    const localStripeCustomer = await db.query.stripeCustomer.findFirst({
      where: (sc, { eq }) => eq(sc.clientId, clientId),
    });
    if (!localStripeCustomer) {
      return NextResponse.json({ error: 'Stripe customer record not found after creation' }, { status: 500 });
    }

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + DAYS_UNTIL_DUE);
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    let newInvoiceId: string;
    await db.transaction(async (tx) => {
      const [newInvoice] = await tx.insert(invoiceTable).values({
        id: createId(),
        stripeCustomerId: localStripeCustomer.id,
        stripeInvoiceId: sentInvoice.id,
        invoiceNumber: generateInvoiceNumber(),
        status: 'SENT',
        amount: totalAmount,
        currency: 'usd',
        dueDate: dueDate.toISOString(),
        description: `Expense reimbursement — ${trip.name}`,
        lineItems,
        isRecurring: false,
        stripeHostedInvoiceUrl: sentInvoice.hosted_invoice_url,
        stripePdfUrl: sentInvoice.invoice_pdf,
        sentAt: now.toISOString(),
        metadata: { invoiceType: 'EXPENSE', tripId },
        updatedAt: now.toISOString(),
      }).returning();
      newInvoiceId = newInvoice.id;

      await tx.update(clientExpense).set({
        status: 'INVOICED',
        invoiceId: newInvoice.id,
        updatedAt: now.toISOString(),
      }).where(inArray(clientExpense.id, expenseIds));
    });

    return NextResponse.json({ success: true, invoiceId: newInvoiceId!, stripeHostedInvoiceUrl: sentInvoice.hosted_invoice_url });
  } catch (err: any) {
    console.error('[expense-trip invoice POST] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await closeDb();
  }
}
