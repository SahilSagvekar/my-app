import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const payrolls = await prisma.payroll.findMany({
      include: {
        employee: {
          select: { name: true, email: true }
        }
      },
      orderBy: { periodStart: "desc" }
    });

    return NextResponse.json({ ok: true, payrolls });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}
