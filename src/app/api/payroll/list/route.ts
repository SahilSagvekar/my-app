export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { payroll } from "@/lib/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const showHidden = searchParams.get("showHidden") === "true";

    // Build date filters
    const conditions = [];

    if (year && month) {
      // Filter by specific month and year
      const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0));
      conditions.push(gte(payroll.periodStart, startDate.toISOString()));
      conditions.push(lte(payroll.periodStart, endDate.toISOString()));
    } else if (year) {
      // Filter by year only
      const startDate = new Date(Date.UTC(parseInt(year), 0, 1));
      const endDate = new Date(Date.UTC(parseInt(year), 11, 31));
      conditions.push(gte(payroll.periodStart, startDate.toISOString()));
      conditions.push(lte(payroll.periodStart, endDate.toISOString()));
    }

    // Only show non-hidden unless explicitly requested
    if (!showHidden) conditions.push(eq(payroll.hidden, false));

    const rawPayrolls = await db.query.payroll.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: {
        user: {
          columns: { name: true, email: true }
        }
      },
      orderBy: desc(payroll.periodStart)
    });
    const payrolls = rawPayrolls.map(({ user, ...p }: any) => ({ ...p, employee: user }));

    // Get available years for filter dropdown
    const allPayrolls = await db.select({ periodStart: payroll.periodStart }).from(payroll)
      .where(showHidden ? undefined : eq(payroll.hidden, false));

    const availableYears = [...new Set(
      allPayrolls.map(p => new Date(p.periodStart).getFullYear())
    )].sort((a, b) => b - a);

    return NextResponse.json({
      ok: true,
      payrolls,
      availableYears
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}
