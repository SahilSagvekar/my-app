export const dynamic = 'force-dynamic';

// GET  /api/clients/[id]/expense-trips — list trips for this client, each
//      with its expenses, a subtotal, and a computed status (derived from
//      the expenses inside it, not stored separately — see comment below).
// POST /api/clients/[id]/expense-trips — create a new (empty) trip to start
//      uploading receipts into.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { expenseTrip, clientExpense } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, desc, inArray } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// A trip's status is derived, not stored, so it can never drift out of sync
// with its expenses:
//   PAID      — every expense is PAID (and there's at least one)
//   INVOICED  — no expenses are PENDING, but not all are PAID yet
//   PENDING   — at least one expense hasn't been invoiced yet
//   EMPTY     — no expenses at all yet
function computeTripStatus(expenses: { status: string }[]): string {
  if (expenses.length === 0) return 'EMPTY';
  if (expenses.every((e) => e.status === 'PAID')) return 'PAID';
  if (expenses.every((e) => e.status !== 'PENDING')) return 'INVOICED';
  return 'PENDING';
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { id: clientId } = await context.params;

    const trips = await db
      .select()
      .from(expenseTrip)
      .where(eq(expenseTrip.clientId, clientId))
      .orderBy(desc(expenseTrip.createdAt));

    if (trips.length === 0) {
      return NextResponse.json({ trips: [] });
    }

    const tripIds = trips.map((t) => t.id);
    const expenses = await db
      .select()
      .from(clientExpense)
      .where(inArray(clientExpense.tripId, tripIds))
      .orderBy(desc(clientExpense.expenseDate));

    const expensesByTrip = new Map<string, typeof expenses>();
    for (const exp of expenses) {
      const list = expensesByTrip.get(exp.tripId) || [];
      list.push(exp);
      expensesByTrip.set(exp.tripId, list);
    }

    const result = trips.map((trip) => {
      const tripExpenses = expensesByTrip.get(trip.id) || [];
      return {
        ...trip,
        // Do not expose object-storage URLs. The receipt endpoint verifies
        // the administrator's access and issues a short-lived URL instead.
        expenses: tripExpenses.map(({ receiptS3Key: _receiptS3Key, receiptUrl: _receiptUrl, ...expense }) => ({
          ...expense,
          receiptUrl: `/api/clients/${clientId}/expense-trips/${trip.id}/expenses/${expense.id}/receipt`,
        })),
        totalAmount: tripExpenses.reduce((sum, e) => sum + e.amount, 0),
        pendingAmount: tripExpenses.filter((e) => e.status === 'PENDING').reduce((sum, e) => sum + e.amount, 0),
        status: computeTripStatus(tripExpenses),
      };
    });

    return NextResponse.json({ trips: result });
  } catch (err: any) {
    console.error('[expense-trips GET] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { id: clientId } = await context.params;
    const body = await req.json();
    const name = (body?.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Trip name is required' }, { status: 400 });
    }

    const [trip] = await db.insert(expenseTrip).values({
      id: createId(),
      clientId,
      name,
            createdById: Number(currentUser!.userId),
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ trip: { ...trip, expenses: [], totalAmount: 0, pendingAmount: 0, status: 'EMPTY' } });
  } catch (err: any) {
    console.error('[expense-trips POST] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
