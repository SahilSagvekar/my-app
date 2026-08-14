export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { user, bonus, deduction, payroll as payrollTable } from "@/lib/db/schema";
import { and, eq, gte, lte, notInArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { countWorkingDaysBetween } from "@/lib/workdays";
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: { year: string; month: string } }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    await requireAdmin(req);

    const { params } = await Promise.resolve(context);
    const year = Number(params.year);
    const monthParam = Number(params.month);

    // Validate year and month (month comes as 1-12 from URL)
    if (isNaN(year) || isNaN(monthParam) || monthParam < 1 || monthParam > 12 || year < 2000 || year > 2100) {
      return NextResponse.json(
        { ok: false, message: "Invalid year or month. Month should be 1-12." },
        { status: 400 }
      );
    }

    const month = monthParam - 1; // Convert to 0-based for Date constructor

    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0));

    // 1) Fetch eligible employees
    const employees = await db.select({
      id: user.id,
      hourlyRate: user.hourlyRate,
      hoursPerWeek: user.hoursPerWeek,
      worksOnSaturday: user.worksOnSaturday,
      joinedAt: user.joinedAt,
    }).from(user).where(and(
      eq(user.employeeStatus, "ACTIVE"),
      notInArray(user.role, ["admin", "client"] as any),
    ));

    const payrolls = [];

    for (const emp of employees) {
      if (!emp.hourlyRate) continue;

      // Default hoursPerWeek to 40 if not set
      const hoursPerWeek = emp.hoursPerWeek ? Number(emp.hoursPerWeek) : 40;
      const hourly = Number(emp.hourlyRate);

      // 2) Calculate working days for this employee (considering join date)
      const joinDate = emp.joinedAt ? new Date(emp.joinedAt) : null;
      const effectiveStart =
        joinDate && joinDate > periodStart ? joinDate : periodStart;

      const actualWorkingDays = countWorkingDaysBetween(
        effectiveStart,
        periodEnd,
        emp.worksOnSaturday ?? false
      );

      if (actualWorkingDays <= 0) {
        // Employee didn't work this month
        continue;
      }

      // Calculate base salary (fixed monthly rate)
      const baseSalary = hourly * hoursPerWeek * 4;

      // 3) Total Bonuses for this period
      const bonuses = await db.select().from(bonus).where(and(
        eq(bonus.employeeId, emp.id),
        gte(bonus.createdAt, periodStart.toISOString()),
        lte(bonus.createdAt, periodEnd.toISOString()),
      ));
      const totalBonuses = bonuses.reduce(
        (s, b) => s + Number(b.amount),
        0
      );

      // 4) Total Deductions for this period
      const deductions = await db.select().from(deduction).where(and(
        eq(deduction.employeeId, emp.id),
        gte(deduction.month, periodStart.toISOString()),
        lte(deduction.month, periodEnd.toISOString()),
      ));
      const totalDeductions = deductions.reduce(
        (s, d) => s + Number(d.amount),
        0
      );

      const netPay = Math.round((baseSalary + totalBonuses - totalDeductions) * 100) / 100;

      // Check if payroll already exists for this employee & month
      const [existing] = await db.select().from(payrollTable).where(and(
        eq(payrollTable.employeeId, emp.id),
        eq(payrollTable.periodStart, periodStart.toISOString()),
        eq(payrollTable.periodEnd, periodEnd.toISOString()),
      )).limit(1);

      let payrollRow;

      if (existing) {
        [payrollRow] = await db.update(payrollTable).set({
          baseSalary: String(baseSalary),
          totalBonuses: String(totalBonuses),
          totalDeductions: String(totalDeductions),
          netPay: String(netPay),
        }).where(eq(payrollTable.id, existing.id)).returning();
      } else {
        [payrollRow] = await db.insert(payrollTable).values({
          employeeId: emp.id,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          baseSalary: String(baseSalary),
          totalBonuses: String(totalBonuses),
          totalDeductions: String(totalDeductions),
          netPay: String(netPay),
        }).returning();
      }

      payrolls.push(payrollRow);
    }

    return NextResponse.json({
      ok: true,
      count: payrolls.length,
      payrolls
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}
