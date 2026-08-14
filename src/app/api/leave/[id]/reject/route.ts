export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { leave } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const db = getDbHttp();
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

    const [foundLeave] = await db.select().from(leave).where(eq(leave.id, leaveId)).limit(1);

    if (!foundLeave) {
      return NextResponse.json(
        { ok: false, message: "Leave not found" },
        { status: 404 }
      );
    }

    if (foundLeave.status === "REJECTED") {
      return NextResponse.json(
        { ok: false, message: "Leave already rejected" },
        { status: 400 }
      );
    }

    const [updated] = await db.update(leave).set({
      status: "REJECTED",
    }).where(eq(leave.id, leaveId)).returning();

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
