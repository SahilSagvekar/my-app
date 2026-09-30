export const dynamic = 'force-dynamic';

// /api/finance/financials2/expenses
//
// GET  ?month=YYYY-MM — expenses logged for the month (by the date they were
//      incurred), a per-category breakdown, totals, and the category list.
// POST — log an expense. Body: { date "YYYY-MM-DD", amount (USD), description,
//        categoryId | newCategoryName }.
//
// Admin-logged expenses are stored in the existing Expense table as APPROVED
// (no approval step — the admin is the approver) and non-reimbursable.
// Admin only.

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { expense as expenseTable, expenseCategory as categoryTable, user as userTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { getJwtUserId, getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { monthBounds, num } from '@/lib/finance/client-payments';
import { getActiveCategories, resolveCategoryId } from '@/lib/finance/expenses';

const MAX_AMOUNT = 10_000_000;
const COUNTED_STATUSES = ['APPROVED', 'REIMBURSED'] as const;

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const { start, end, label } = monthBounds(new URL(req.url).searchParams.get('month'));

    const [categories, rows] = await Promise.all([
      getActiveCategories(db),
      db
        .select({
          id: expenseTable.id,
          dateIncurred: expenseTable.dateIncurred,
          amount: expenseTable.amount,
          description: expenseTable.description,
          status: expenseTable.status,
          categoryId: expenseTable.categoryId,
          categoryName: categoryTable.name,
          loggedByName: userTable.name,
        })
        .from(expenseTable)
        .leftJoin(categoryTable, eq(expenseTable.categoryId, categoryTable.id))
        .leftJoin(userTable, eq(expenseTable.submittedById, userTable.id))
        .where(and(
          gte(expenseTable.dateIncurred, start.toISOString()),
          lt(expenseTable.dateIncurred, end.toISOString()),
          inArray(expenseTable.status, ['APPROVED', 'REIMBURSED', 'SUBMITTED']),
        ))
        .orderBy(desc(expenseTable.dateIncurred), desc(expenseTable.createdAt)),
    ]);

    const expenses = rows.map((r) => ({
      id: r.id,
      date: r.dateIncurred,
      amount: num(r.amount),
      description: r.description,
      status: r.status,
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? 'Uncategorized',
      loggedByName: r.loggedByName,
    }));

    const counted = expenses.filter((e) => (COUNTED_STATUSES as readonly string[]).includes(e.status));
    const total = counted.reduce((s, e) => s + e.amount, 0);
    const byCat = new Map<string, { categoryId: string; name: string; total: number; count: number }>();
    for (const e of counted) {
      const c = byCat.get(e.categoryId) ?? { categoryId: e.categoryId, name: e.categoryName, total: 0, count: 0 };
      c.total += e.amount;
      c.count += 1;
      byCat.set(e.categoryId, c);
    }

    return NextResponse.json({
      ok: true,
      month: label,
      summary: { total, count: counted.length },
      byCategory: [...byCat.values()].sort((a, b) => b.total - a.total),
      expenses,
      categories,
    });
  } catch (err: any) {
    console.error('[financials2/expenses GET]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

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

    const amount = Number(body.amount);
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return NextResponse.json({ ok: false, message: 'Enter an amount greater than 0' }, { status: 400 });
    }
    if (!description) return NextResponse.json({ ok: false, message: 'Add a short description' }, { status: 400 });
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || Number.isNaN(Date.parse(body.date))) {
      return NextResponse.json({ ok: false, message: 'Choose the date of the expense' }, { status: 400 });
    }

    const categoryId = await resolveCategoryId(db, body.categoryId, body.newCategoryName);
    if (!categoryId) return NextResponse.json({ ok: false, message: 'Choose a category' }, { status: 400 });

    const now = new Date().toISOString();
    const adminId = getJwtUserId(currentUser);
    if (adminId === null) {
      return NextResponse.json({ ok: false, message: 'Could not identify your account — please sign in again' }, { status: 401 });
    }
    const [created] = await db
      .insert(expenseTable)
      .values({
        id: createId(),
        submittedById: adminId,
        categoryId,
        amount: String(Math.round(amount * 100) / 100),
        dateIncurred: `${body.date}T12:00:00.000Z`, // noon UTC: never slips into a neighbouring month
        description,
        isReimbursable: false,
        status: 'APPROVED',
        approvedById: adminId,
        approvedAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ ok: true, expense: created }, { status: 201 });
  } catch (err: any) {
    console.error('[financials2/expenses POST]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
