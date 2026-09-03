export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { clientExpense, expenseTrip, user as userTable } from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth-helpers';

function tripStatus(expenses: { status: string }[]) {
  if (!expenses.length) return 'EMPTY';
  if (expenses.every((expense) => expense.status === 'PAID')) return 'PAID';
  if (expenses.every((expense) => expense.status !== 'PENDING')) return 'INVOICED';
  return 'PENDING';
}

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const session = getUserFromToken(req);
    if (!session || session.role?.toLowerCase() !== 'client') {
      return NextResponse.json({ error: 'Client access required' }, { status: 403 });
    }

    const account = await db.query.user.findFirst({
      where: eq(userTable.id, session.userId || session.id),
      with: { clients: true },
    });
    const clientId = account?.linkedClientId || account?.clients?.[0]?.id;
    if (!clientId) return NextResponse.json({ error: 'No client account linked to this user' }, { status: 404 });

    const trips = await db.select().from(expenseTrip)
      .where(eq(expenseTrip.clientId, clientId)).orderBy(desc(expenseTrip.createdAt));
    if (!trips.length) return NextResponse.json({ trips: [] });

    const expenses = await db.select().from(clientExpense)
      .where(inArray(clientExpense.tripId, trips.map((trip) => trip.id)))
      .orderBy(desc(clientExpense.expenseDate));
    const byTrip = new Map<string, typeof expenses>();
    for (const expense of expenses) byTrip.set(expense.tripId, [...(byTrip.get(expense.tripId) || []), expense]);

    return NextResponse.json({
      trips: trips.map((trip) => {
        const items = byTrip.get(trip.id) || [];
        return {
          id: trip.id,
          name: trip.name,
          totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
          status: tripStatus(items),
          expenses: items.map(({ receiptUrl: _receiptUrl, receiptS3Key: _receiptS3Key, ...expense }) => ({
            ...expense,
            receiptUrl: `/api/client/expenses/receipts/${expense.id}`,
          })),
        };
      }),
    });
  } catch (error) {
    console.error('[client expenses GET]', error);
    return NextResponse.json({ error: 'Unable to load expenses' }, { status: 500 });
  }
}
