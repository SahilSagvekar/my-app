import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { countWorkingDaysBetween } from "@/lib/workdays";
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: { year: string; month: string } }
) {
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
    const employees = await prisma.user.findMany({
      where: {
        employeeStatus: "ACTIVE",
        role: { notIn: ["admin", "client"] }
      },
      select: {
        id: true,
        hourlyRate: true,
        hoursPerWeek: true,
        worksOnSaturday: true,
        joinedAt: true
      }
    });

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
      const bonuses = await prisma.bonus.findMany({
        where: {
          employeeId: emp.id,
          createdAt: { gte: periodStart, lte: periodEnd }
        }
      });
      const totalBonuses = bonuses.reduce(
        (s, b) => s + Number(b.amount),
        0
      );

      // 4) Total Deductions for this period
      const deductions = await prisma.deduction.findMany({
        where: {
          employeeId: emp.id,
          month: {
            gte: periodStart,
            lte: periodEnd
          }
        }
      });
      const totalDeductions = deductions.reduce(
        (s, d) => s + Number(d.amount),
        0
      );

      const netPay = Math.round((baseSalary + totalBonuses - totalDeductions) * 100) / 100;

      // Check if payroll already exists for this employee & month
      const existing = await prisma.payroll.findFirst({
        where: {
          employeeId: emp.id,
          periodStart,
          periodEnd
        }
      });

      let payroll;

      if (existing) {
        payroll = await prisma.payroll.update({
          where: { id: existing.id },
          data: {
            baseSalary,
            totalBonuses,
            totalDeductions,
            netPay
          }
        });
      } else {
        payroll = await prisma.payroll.create({
          data: {
            employeeId: emp.id,
            periodStart,
            periodEnd,
            baseSalary,
            totalBonuses,
            totalDeductions,
            netPay
          }
        });
      }

      payrolls.push(payroll);
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
}
