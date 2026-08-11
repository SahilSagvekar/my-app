export const dynamic = 'force-dynamic';
// app/api/employee/[id]/profile/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userTable, bonus, deduction } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { parseISO } from 'date-fns';
import { requireAdmin, getRequestingUser, isEmployee } from '@/lib/auth';

function countWeekdaysBetween(start: Date, end: Date) {
  let d = new Date(start);
  let count = 0;
  while (d <= end) {
    const day = d.getDay(); // 0 Sun - 6 Sat
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function GET(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    const requesting = await getRequestingUser(req as any);
    // allow admin or the employee themself
    if (!requesting) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const id = Number(params.employeeId);
    if (!id) return NextResponse.json({ ok: false, message: 'Invalid id' }, { status: 400 });

    if (!(requesting.role === 'admin' || requesting.id === id)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month'); // 1-12
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    const month = monthParam ? Number(monthParam) - 1 : new Date().getMonth(); // 0-based

    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0));

    const [user] = await db.select({
      id: userTable.id, name: userTable.name, email: userTable.email, hourlyRate: userTable.hourlyRate,
      monthlyBaseHours: userTable.monthlyBaseHours, employeeStatus: userTable.employeeStatus, joinedAt: userTable.joinedAt,
    }).from(userTable).where(eq(userTable.id, id)).limit(1);

    if (!user) return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });

    // bonuses in month
    const bonuses = await db.select().from(bonus).where(and(
      eq(bonus.employeeId, id),
      gte(bonus.createdAt, periodStart.toISOString()),
      lte(bonus.createdAt, periodEnd.toISOString()),
    ));
    const totalBonuses = bonuses.reduce((s, b) => s + Number(b.amount), 0);

    // deductions in month
    const deductions = await db.select().from(deduction).where(and(
      eq(deduction.employeeId, id),
      gte(deduction.month, periodStart.toISOString()),
      lte(deduction.month, periodEnd.toISOString()),
    ));
    const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);

    // working days — default Mon-Fri between periodStart and periodEnd, also respect join date
    const joinDate = user.joinedAt ? new Date(user.joinedAt) : null;
    const calcStart = joinDate && joinDate > periodStart ? joinDate : periodStart;
    const workingDays = countWeekdaysBetween(calcStart, periodEnd);

    const hourly = user.hourlyRate ? Number(user.hourlyRate) : 0;
    const baseSalary = hourly * 8 * workingDays;
    const netPay = baseSalary + totalBonuses - totalDeductions;

    return NextResponse.json({
      ok: true,
      data: {
        employee: user,
        periodStart,
        periodEnd,
        workingDays,
        baseSalary,
        totalBonuses,
        totalDeductions,
        netPay,
      }
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 500 });
  }
}
