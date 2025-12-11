import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyLeaveRequestApproved } from "@/lib/notificationTriggers";

function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  worksOnSaturday: boolean
) {
  let count = 0;
  const d = new Date(startDate);

  while (d <= endDate) {
    const day = d.getDay();
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
  try {
    await requireAdmin(req as any);

    const leaveId = Number(params.id);
    if (Number.isNaN(leaveId)) throw new Error("Invalid leave id");

    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        employee: {
          select: {
            id: true,
            hourlyRate: true,
            worksOnSaturday: true,
          },
        },
      },
    });

    if (!leave) throw new Error("Leave not found");
    if (!leave.employee) throw new Error("Employee not found for this leave");

    const employee = leave.employee;

    if (!employee.hourlyRate) {
      throw new Error("Employee has no hourlyRate; cannot compute deduction.");
    }

    const start = leave.startDate;
    const end = leave.endDate;

    const leaveDays = calculateLeaveDays(
      start,
      end,
      employee.worksOnSaturday ?? false
    );

    if (leaveDays <= 0)
      throw new Error("Calculated leave days is zero; cannot approve.");

    const hourlyRate = Number(employee.hourlyRate);
    const deductionAmount = hourlyRate * 8 * leaveDays;

    const firstDayOfMonth = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    );

    const [updatedLeave, deduction] = await prisma.$transaction([
      prisma.leave.update({
        where: { id: leaveId },
        data: {
          status: "APPROVED",
          numberOfDays: leaveDays,
        },
      }),
      prisma.deduction.create({
        data: {
          employeeId: employee.id,
          leaveId: leaveId,
          amount: deductionAmount,
          month: firstDayOfMonth,
        },
      }),
    ]);

    // 🔔 NOTIFY EMPLOYEE OF APPROVAL
    await notifyLeaveRequestApproved(
      employee.id,
      start.toLocaleDateString(),
      end.toLocaleDateString()
    );

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