export const dynamic = 'force-dynamic';

// /api/finance/financials2/expenses/:id
// PUT    — edit a logged expense (same body as POST).
// DELETE — remove a logged expense.
// Admin only.

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { expense as expenseTable } from '@/lib/db/schema';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { resolveCategoryId } from '@/lib/finance/expenses';

const MAX_AMOUNT = 10_000_000;

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });

    const amount = Number(body.amount);
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return NextResponse.json({ ok: false, message: 'Enter an amount greater than 0' }, { status: 400 });
    }
    if (!description) return NextResponse.json({ ok: false, message: 'Add a short description' }, { status: 400 });
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || Number.isNaN(Date.parse(body.date))) {
      return NextResponse.json({ ok: false, message: 'Choose the date of the expense' }, { status: 400 });
    }

    const [existing] = await db.select({ id: expenseTable.id }).from(expenseTable).where(eq(expenseTable.id, id)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, message: 'Expense not found' }, { status: 404 });

    const categoryId = await resolveCategoryId(db, body.categoryId, body.newCategoryName);
    if (!categoryId) return NextResponse.json({ ok: false, message: 'Choose a category' }, { status: 400 });

    const [updated] = await db
      .update(expenseTable)
      .set({
        categoryId,
        amount: String(Math.round(amount * 100) / 100),
        dateIncurred: `${body.date}T12:00:00.000Z`,
        description,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(expenseTable.id, id))
      .returning();

    return NextResponse.json({ ok: true, expense: updated });
  } catch (err: any) {
    console.error('[financials2/expenses PUT]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }
    const { id } = await context.params;
    const deleted = await db.delete(expenseTable).where(eq(expenseTable.id, id)).returning({ id: expenseTable.id });
    if (deleted.length === 0) return NextResponse.json({ ok: false, message: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[financials2/expenses DELETE]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
