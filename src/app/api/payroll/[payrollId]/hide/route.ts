export const dynamic = 'force-dynamic';
import { getDb } from "@/lib/db";
import { payroll } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function PATCH(
    req: NextRequest,
    context: { params: { payrollId: string } }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        await requireAdmin(req);

        const { params } = await Promise.resolve(context);
        const payrollId = parseInt(params.payrollId);

        if (isNaN(payrollId)) {
            return NextResponse.json(
                { ok: false, message: "Invalid payroll ID" },
                { status: 400 }
            );
        }

        // Check if payroll exists
        const [existing] = await db.select().from(payroll).where(eq(payroll.id, payrollId)).limit(1);

        if (!existing) {
            return NextResponse.json(
                { ok: false, message: "Payroll record not found" },
                { status: 404 }
            );
        }

        // Toggle or set hidden status
        const body = await req.json().catch(() => ({}));
        const hidden = body.hidden !== undefined ? body.hidden : !existing.hidden;

        const [updated] = await db.update(payroll).set({ hidden }).where(eq(payroll.id, payrollId)).returning();

        return NextResponse.json({
            ok: true,
            message: hidden ? "Payroll record hidden" : "Payroll record restored",
            payroll: updated
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json(
            { ok: false, message: err?.message || "Failed to update payroll" },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
