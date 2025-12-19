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
    const month = Number(params.month) - 1; // 0 based

    if (!year || !month.toString() || month < 0 || month > 11) {
      return NextResponse.json(
        { ok: false, message: "Invalid year or month" },
        { status: 400 }
      );
    }

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

      // 2) Working days for this employee
      const joinDate = emp.joinedAt ? new Date(emp.joinedAt) : null;
      const effectiveStart =
        joinDate && joinDate > periodStart ? joinDate : periodStart;

      const workingDays = countWorkingDaysBetween(
        effectiveStart,
        periodEnd,
        emp.worksOnSaturday ?? false
      );

      if (workingDays <= 0) {
        // employee didn't work this month
        continue;
      }

      const hourly = Number(emp.hourlyRate);
      const hoursPerWeek = Number(emp.hoursPerWeek);
      // const baseSalary = hourly * 8 * workingDays;
      const baseSalary = hourly * hoursPerWeek * 4;

      // 3) Total Bonuses
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

      // 4) Total Deductions
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

      const netPay = baseSalary + totalBonuses - totalDeductions;

      // const payroll = await prisma.payroll.create({
      //   data: {
      //     employeeId: emp.id,
      //     periodStart,
      //     periodEnd,
      //     baseSalary,
      //     totalBonuses,
      //     totalDeductions,
      //     netPay
      //   }
      // });

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
