// app/api/employee/[id]/profile/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const requesting = await getRequestingUser(req as any);
    // allow admin or the employee themself
    if (!requesting) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const id = Number(params.id);
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

    const user = await prisma.user.findUnique({ where: { id }, select: {
      id: true, name: true, email: true, hourlyRate: true, monthlyBaseHours: true, employeeStatus: true, joinedAt: true
    } });

    if (!user) return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });

    // bonuses in month
    const bonuses = await prisma.bonus.findMany({
      where: {
        employeeId: id,
        createdAt: { gte: periodStart, lte: periodEnd }
      }
    });
    const totalBonuses = bonuses.reduce((s, b) => s + Number(b.amount), 0);

    // deductions in month
    const deductions = await prisma.deduction.findMany({
      where: {
        employeeId: id,
        month: {
          gte: periodStart,
          lte: periodEnd
        }
      }
    });
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
