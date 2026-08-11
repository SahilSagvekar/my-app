export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payroll } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  context: { params: { payrollId: string } }
) {
  try {
    await requireAdmin  (req);
    const { payrollId } = await Promise.resolve(context.params);

    const [updated] = await db.update(payroll).set({
      status: "PAID",
      paidAt: new Date().toISOString(),
    }).where(eq(payroll.id, Number(payrollId))).returning();

    return NextResponse.json({ ok: true, payroll: updated });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
