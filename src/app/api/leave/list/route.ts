export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { leave } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const { db, closeDb } = getDb();
  try {
  try {
    await requireAdmin(req as any);

    const leaves = await db.query.leave.findMany({
      orderBy: desc(leave.createdAt),
      with: {
        user: {
          columns: { id: true, name: true, email: true, worksOnSaturday: true },
        },
      },
    });

    const formatted = leaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.user?.name || l.user?.email || "Unknown",
      startDate: new Date(l.startDate).toISOString().split("T")[0],
      endDate: new Date(l.endDate).toISOString().split("T")[0],
      reason: l.reason,
      status: l.status.toLowerCase(),
      worksOnSaturday: l.user?.worksOnSaturday ?? false,
    }));

    return NextResponse.json({ ok: true, leaves: formatted });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message || "Something went wrong" },
      { status: 400 }
    );
  }

  } finally {
    await closeDb();
  }
}
