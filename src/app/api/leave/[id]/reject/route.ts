import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
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
    });

    if (!leave) {
      return NextResponse.json(
        { ok: false, message: "Leave not found" },
        { status: 404 }
      );
    }

    if (leave.status === "REJECTED") {
      return NextResponse.json(
        { ok: false, message: "Leave already rejected" },
        { status: 400 }
      );
    }

    const updated = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: "REJECTED",
      },
    });

    // NOTE: we do NOT auto-delete deduction here because it should not exist for rejected leave.

    return NextResponse.json({ ok: true, leave: updated });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}
