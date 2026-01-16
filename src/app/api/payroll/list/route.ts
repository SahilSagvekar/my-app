import { prisma } from "@/lib/prisma";
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
    let dateFilter: any = {};

    if (year && month) {
      // Filter by specific month and year
      const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0));
      dateFilter = {
        periodStart: {
          gte: startDate,
          lte: endDate
        }
      };
    } else if (year) {
      // Filter by year only
      const startDate = new Date(Date.UTC(parseInt(year), 0, 1));
      const endDate = new Date(Date.UTC(parseInt(year), 11, 31));
      dateFilter = {
        periodStart: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    const payrolls = await prisma.payroll.findMany({
      where: {
        ...dateFilter,
        // Only show non-hidden unless explicitly requested
        ...(showHidden ? {} : { hidden: false })
      },
      include: {
        employee: {
          select: { name: true, email: true }
        }
      },
      orderBy: { periodStart: "desc" }
    });

    // Get available years for filter dropdown
    const allPayrolls = await prisma.payroll.findMany({
      select: { periodStart: true },
      where: showHidden ? {} : { hidden: false }
    });

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
