import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin(req as any);

    const leaves = await prisma.leave.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            worksOnSaturday: true,
          },
        },
      },
    });

    const formatted = leaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employee?.name || l.employee?.email || "Unknown",
      startDate: l.startDate.toISOString().split("T")[0],
      endDate: l.endDate.toISOString().split("T")[0],
      reason: l.reason,
      status: l.status.toLowerCase(),
      worksOnSaturday: l.employee?.worksOnSaturday ?? false,
    }));

    return NextResponse.json({ ok: true, leaves: formatted });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message || "Something went wrong" },
      { status: 400 }
    );
  }
}
