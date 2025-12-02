import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  context: { params: { payrollId: string } }
) {
  try {
    await requireAdmin(req);
    const { payrollId } = await Promise.resolve(context.params);

    const updated = await prisma.payroll.update({
      where: { id: Number(payrollId) },
      data: {
        status: "PAID",
        paidAt: new Date()
      }
    });

    return NextResponse.json({ ok: true, payroll: updated });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
