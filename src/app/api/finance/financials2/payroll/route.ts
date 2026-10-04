export const dynamic = 'force-dynamic';

// /api/finance/financials2/payroll?month=YYYY-MM
//
// GET — every payroll-eligible employee for the month with their pay status
//       and the amount recorded, plus totals. Also returns `totalHours` (time
//       clocked in that month, from TimeClockEntry) and `calculatedAmount`
//       (totalHours × hourlyRate) — read-only reference figures; the admin still
//       enters the actual `amount` paid.
// PUT — set one employee's Paid/Unpaid status and/or amount for the month.
//       Body: { employeeId, month "YYYY-MM", status?: "PAID"|"PENDING", amount?: number }
//       Or change their hourly rate: { employeeId, hourlyRate: number } (no month;
//       updates User.hourlyRate and writes an audit-log entry).
//
// Rows live in the existing Payroll table (one per employee per month, same
// period keys as /api/payroll/generate), so the Finance tab, this page and the
// Financials 2 overview card all agree. "Unpaid" = PENDING. `netPay` is the
// amount the admin enters; `baseSalary` keeps the estimated monthly figure.
// Admin only.

import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, gte, lt, notInArray } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { payroll as payrollTable, timeClockEntry, user as userTable } from '@/lib/db/schema';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { monthBounds, num } from '@/lib/finance/client-payments';
import { dbTimestampToDate, getESTDateString } from '@/lib/est-date';
import { AuditAction, createAuditLog, getRequestMetadata } from '@/lib/audit-logger';

const MAX_AMOUNT = 10_000_000;
const MAX_HOURLY_RATE = 10_000;

// Same estimate the payroll generator uses: hourly × hours/week × 4.
const estMonthly = (hourlyRate: unknown, hoursPerWeek: unknown): number | null => {
  const hourly = num(hourlyRate);
  if (!hourly) return null;
  const hours = num(hoursPerWeek) || 40;
  return Math.round(hourly * hours * 4 * 100) / 100;
};

// Contractors (hosts) are paid per shoot, admins aren't on payroll, clients aren't staff.
const EXCLUDED_ROLES = ['admin', 'client', 'host'] as any;

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const { start, end, label } = monthBounds(new URL(req.url).searchParams.get('month'));

    // TimeClockEntry.workDate is a 'YYYY-MM-DD' US Eastern date string, so the
    // month's entries are the lexicographic range [YYYY-MM-01, next month 01).
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const workDateFrom = `${label}-01`;
    const workDateTo = `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-01`;
    const todayEst = getESTDateString();
    const nowMs = Date.now();

    const [employees, rows, clockEntries] = await Promise.all([
      db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          role: userTable.role,
          hourlyRate: userTable.hourlyRate,
          hoursPerWeek: userTable.hoursPerWeek,
        })
        .from(userTable)
        .where(and(eq(userTable.employeeStatus, 'ACTIVE'), notInArray(userTable.role, EXCLUDED_ROLES)))
        .orderBy(asc(userTable.name)),
      db
        .select({
          id: payrollTable.id,
          employeeId: payrollTable.employeeId,
          netPay: payrollTable.netPay,
          status: payrollTable.status,
          paidAt: payrollTable.paidAt,
        })
        .from(payrollTable)
        .where(and(gte(payrollTable.periodStart, start.toISOString()), lt(payrollTable.periodStart, end.toISOString()))),
      db
        .select({
          userId: timeClockEntry.userId,
          workDate: timeClockEntry.workDate,
          clockInAt: timeClockEntry.clockInAt,
          clockOutAt: timeClockEntry.clockOutAt,
        })
        .from(timeClockEntry)
        .where(and(gte(timeClockEntry.workDate, workDateFrom), lt(timeClockEntry.workDate, workDateTo))),
    ]);

    // Minutes clocked in per employee for the month. Entries still clocked in
    // count up to now — but only for today's entry: an older entry with no
    // clock-out (e.g. the nightly auto-close failed) has no known end time, so it
    // contributes nothing rather than growing forever. Auto-closed days (the
    // nightly job closes forgotten clock-outs) count like any other day.
    const minutesByUser = new Map<number, number>();
    for (const e of clockEntries) {
      const clockIn = dbTimestampToDate(e.clockInAt).getTime();
      let clockOut: number;
      if (e.clockOutAt) clockOut = dbTimestampToDate(e.clockOutAt).getTime();
      else if (e.workDate === todayEst) clockOut = nowMs;
      else continue;
      const minutes = Math.max(0, (clockOut - clockIn) / 60000);
      minutesByUser.set(e.userId, (minutesByUser.get(e.userId) ?? 0) + minutes);
    }

    const byEmployee = new Map(rows.map((r) => [r.employeeId, r]));

    const list = employees.map((e) => {
      const p = byEmployee.get(e.id);
      const minutes = minutesByUser.get(e.id) ?? 0;
      const hourly = e.hourlyRate ? num(e.hourlyRate) : null;
      return {
        employeeId: e.id,
        name: e.name || e.email,
        role: e.role,
        hourlyRate: hourly,
        estMonthly: estMonthly(e.hourlyRate, e.hoursPerWeek),
        totalHours: Math.round((minutes / 60) * 100) / 100,
        // From unrounded minutes so rounding the hours doesn't shift the amount.
        calculatedAmount: hourly ? Math.round((minutes / 60) * hourly * 100) / 100 : null,
        status: (p?.status ?? 'PENDING') as 'PENDING' | 'PAID',
        amount: p ? num(p.netPay) : null,
        paidAt: p?.paidAt ?? null,
      };
    });

    const paidTotal = list.filter((r) => r.status === 'PAID').reduce((s, r) => s + (r.amount ?? 0), 0);
    const estTotal = list.reduce((s, r) => s + (r.estMonthly ?? 0), 0);
    const hoursTotal = Math.round(list.reduce((s, r) => s + r.totalHours, 0) * 100) / 100;
    const calculatedTotal = Math.round(list.reduce((s, r) => s + (r.calculatedAmount ?? 0), 0) * 100) / 100;

    return NextResponse.json({
      ok: true,
      month: label,
      employees: list,
      totals: {
        employeeCount: list.length,
        paidCount: list.filter((r) => r.status === 'PAID').length,
        unpaidCount: list.filter((r) => r.status !== 'PAID').length,
        paidTotal,
        estTotal,
        hoursTotal,
        calculatedTotal,
      },
    });
  } catch (err: any) {
    console.error('[financials2/payroll GET]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = getDbHttp();
  try {
    const actor = getUserFromToken(req);
    const adminCheck = requireAdmin(actor);
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });

    const employeeId = Number(body.employeeId);
    if (!Number.isInteger(employeeId)) {
      return NextResponse.json({ ok: false, message: 'employeeId is required' }, { status: 400 });
    }

    // Hourly-rate edit — changes the employee's rate itself (User.hourlyRate),
    // not a per-month value, so it needs no `month`. It affects the rate shown
    // on every month's row, the Est. Monthly figure and Calculated Amount.
    if (body.hourlyRate !== undefined) {
      const rate = Number(body.hourlyRate);
      if (body.hourlyRate === null || body.hourlyRate === '' || !Number.isFinite(rate) || rate < 0 || rate > MAX_HOURLY_RATE) {
        return NextResponse.json({ ok: false, message: 'Enter a valid hourly rate' }, { status: 400 });
      }
      const nextRate = Math.round(rate * 100) / 100;

      const [target] = await db
        .select({ id: userTable.id, name: userTable.name, email: userTable.email, hourlyRate: userTable.hourlyRate })
        .from(userTable)
        .where(eq(userTable.id, employeeId))
        .limit(1);
      if (!target) return NextResponse.json({ ok: false, message: 'Employee not found' }, { status: 404 });

      const previousRate = target.hourlyRate ? num(target.hourlyRate) : null;
      if (previousRate === nextRate) return NextResponse.json({ ok: true, unchanged: true, hourlyRate: nextRate });

      await db
        .update(userTable)
        .set({ hourlyRate: String(nextRate), updatedAt: new Date().toISOString() })
        .where(eq(userTable.id, employeeId));

      // Pay rates are sensitive — leave a trail of who changed what. Never let a
      // logging failure undo or block the change itself.
      try {
        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
          userId: actor!.id,
          action: AuditAction.USER_UPDATED,
          entity: 'User',
          entityId: employeeId,
          details: `Changed hourly rate for ${target.name || target.email}: ${previousRate ?? 'not set'} → ${nextRate}`,
          metadata: { field: 'hourlyRate', from: previousRate, to: nextRate, via: 'financials2/payroll' },
          ipAddress,
          userAgent,
        });
      } catch (auditErr) {
        console.error('[financials2/payroll PUT] audit log failed:', auditErr);
      }

      return NextResponse.json({ ok: true, hourlyRate: nextRate });
    }

    if (typeof body.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) {
      return NextResponse.json({ ok: false, message: 'month must be YYYY-MM' }, { status: 400 });
    }
    const status: 'PAID' | 'PENDING' | undefined =
      body.status === undefined ? undefined : body.status === 'PAID' ? 'PAID' : body.status === 'PENDING' ? 'PENDING' : (null as any);
    if (status === null) return NextResponse.json({ ok: false, message: 'status must be PAID or PENDING' }, { status: 400 });

    let amount: number | undefined;
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
      amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
        return NextResponse.json({ ok: false, message: 'Enter a valid amount' }, { status: 400 });
      }
      amount = Math.round(amount * 100) / 100;
    }

    const [emp] = await db
      .select({ id: userTable.id, hourlyRate: userTable.hourlyRate, hoursPerWeek: userTable.hoursPerWeek })
      .from(userTable)
      .where(eq(userTable.id, employeeId))
      .limit(1);
    if (!emp) return NextResponse.json({ ok: false, message: 'Employee not found' }, { status: 404 });

    const { start, end } = monthBounds(body.month);
    const periodStart = start.toISOString();
    const periodEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString();

    const [existing] = await db
      .select()
      .from(payrollTable)
      .where(and(
        eq(payrollTable.employeeId, employeeId),
        gte(payrollTable.periodStart, periodStart),
        lt(payrollTable.periodStart, end.toISOString()),
      ))
      .limit(1);

    const nextStatus = status ?? existing?.status ?? 'PENDING';
    const nextAmount = amount ?? (existing ? num(existing.netPay) : undefined);

    if (nextStatus === 'PAID' && !(nextAmount && nextAmount > 0)) {
      return NextResponse.json({ ok: false, message: 'Enter the amount paid before marking as Paid' }, { status: 400 });
    }

    // Nothing to record: unpaid, no amount, no existing row.
    if (!existing && nextStatus === 'PENDING' && nextAmount === undefined) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const paidAt = nextStatus === 'PAID' ? existing?.paidAt ?? new Date().toISOString() : null;

    if (existing) {
      const [updated] = await db
        .update(payrollTable)
        .set({ status: nextStatus, netPay: String(nextAmount ?? 0), paidAt })
        .where(eq(payrollTable.id, existing.id))
        .returning();
      return NextResponse.json({ ok: true, payroll: updated });
    }

    const [created] = await db
      .insert(payrollTable)
      .values({
        employeeId,
        periodStart,
        periodEnd,
        baseSalary: String(estMonthly(emp.hourlyRate, emp.hoursPerWeek) ?? 0),
        totalBonuses: '0',
        totalDeductions: '0',
        netPay: String(nextAmount ?? 0),
        status: nextStatus,
        paidAt,
      })
      .returning();
    return NextResponse.json({ ok: true, payroll: created }, { status: 201 });
  } catch (err: any) {
    console.error('[financials2/payroll PUT]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
