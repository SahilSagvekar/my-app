export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { leave as leaveTable, deduction as deductionTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  worksOnSaturday: boolean
) {
  let count = 0;
  const d = new Date(startDate);

  while (d <= endDate) {
    const day = d.getDay(); // 0 = Sun, 6 = Sat
    if (day !== 0) {
      if (day === 6 && !worksOnSaturday) {
        // skip Saturday
      } else {
        count++;
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return count;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    await requireAdmin(req as any);

    const leaveId = Number(params.id);
    if (Number.isNaN(leaveId)) throw new Error("Invalid leave id");

    const leave = await db.query.leave.findFirst({
      where: eq(leaveTable.id, leaveId),
      with: {
        user: {
          columns: { id: true, hourlyRate: true, worksOnSaturday: true },
        },
      },
    });

    if (!leave) throw new Error("Leave not found");
    if (!leave.user) throw new Error("Employee not found for this leave");

    const employee = leave.user;

    if (!employee.hourlyRate) {
      throw new Error("Employee has no hourlyRate; cannot compute deduction.");
    }

    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    const leaveDays = calculateLeaveDays(
      start,
      end,
      employee.worksOnSaturday ?? false
    );

    if (leaveDays <= 0)
      throw new Error("Calculated leave days is zero; cannot approve.");

    const hourlyRate = Number(employee.hourlyRate);
    const deductionAmount = hourlyRate * 8 * leaveDays;

    // 🔥 FIX: convert (year, month) -> DateTime
    const firstDayOfMonth = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    );

    const [[updatedLeave], [deduction]] = await db.batch([
      db.update(leaveTable).set({
        status: "APPROVED",
        numberOfDays: leaveDays,
      }).where(eq(leaveTable.id, leaveId)).returning(),
      db.insert(deductionTable).values({
        employeeId: employee.id,
        leaveId: leaveId,
        amount: String(deductionAmount),
        month: firstDayOfMonth.toISOString(), // DateTime ✔
        // year: firstDayOfMonth,  // DateTime ✔
        // reason: "LEAVE",
      }).returning(),
    ]);

    return NextResponse.json({
      ok: true,
      leave: updatedLeave,
      deduction,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err.message || "Something went wrong" },
      { status: 400 }
    );
  }
}
