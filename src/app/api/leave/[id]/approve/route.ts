import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin(req);
    const { params } = await Promise.resolve(context);
    const leaveId = Number(params.id);

    if (!leaveId || Number.isNaN(leaveId)) {
      return NextResponse.json(
        { ok: false, message: "Invalid leave id" },
        { status: 400 }
      );
    }

    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        employee: true,
        deduction: true,
      },
    });

    if (!leave) {
      return NextResponse.json(
        { ok: false, message: "Leave not found" },
        { status: 404 }
      );
    }

    if (leave.status === "APPROVED") {
      return NextResponse.json(
        { ok: false, message: "Leave already approved" },
        { status: 400 }
      );
    }

    if (!leave.employee.hourlyRate) {
      return NextResponse.json(
        {
          ok: false,
          message: "Employee has no hourlyRate set; cannot compute deduction.",
        },
        { status: 400 }
      );
    }

    // Approve leave
    const updatedLeave = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: "APPROVED",
        approvedBy: admin.id,
      },
    });

    // If deduction already exists (shouldn't normally), don't recreate
    let deduction = leave.deduction;
    if (!deduction) {
      const hourly = Number(leave.employee.hourlyRate);
      const deductionAmount = hourly * 8 * leave.numberOfDays;

      const month = new Date(
        leave.startDate.getUTCFullYear(),
        leave.startDate.getUTCMonth(),
        1
      );

      deduction = await prisma.deduction.create({
        data: {
          employeeId: leave.employeeId,
          amount: deductionAmount,
          leaveId: leave.id,
          month,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      leave: updatedLeave,
      deduction,
    });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}
