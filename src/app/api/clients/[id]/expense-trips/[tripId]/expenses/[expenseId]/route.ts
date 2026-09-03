export const dynamic = 'force-dynamic';

// DELETE /api/clients/[id]/expense-trips/[tripId]/expenses/[expenseId]
// Only allowed while the expense is still PENDING — once it's on a real
// Stripe invoice (INVOICED/PAID), it stays as a record even if the receipt
// upload itself was a mistake; edit the invoice in Stripe directly instead.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { clientExpense } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { deleteFromS3 } from '@/lib/s3';

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; tripId: string; expenseId: string }> }) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { tripId, expenseId } = await context.params;

    const [expense] = await db.select().from(clientExpense).where(eq(clientExpense.id, expenseId)).limit(1);
    if (!expense || expense.tripId !== tripId) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    if (expense.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending (not yet invoiced) expenses can be deleted' }, { status: 400 });
    }

    // Delete the object after authorizing the row; if storage is unavailable,
    // retain the row so an administrator can retry rather than orphaning it.
    await deleteFromS3(expense.receiptS3Key);
    await db.delete(clientExpense).where(eq(clientExpense.id, expenseId));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[expenses DELETE] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
