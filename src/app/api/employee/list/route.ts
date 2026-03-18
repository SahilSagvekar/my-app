export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    // Get status filter from query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    // 🔥 OPTIMIZED: Only select fields needed for the list view
    const employees = await prisma.user.findMany({
      where: {
        OR: [
          { role: null },
          { role: { notIn: ["admin", "client"] } }
        ],
        // Filter by status if provided
        ...(status && { employeeStatus: status as any }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        employeeStatus: true,
        hourlyRate: true,
        hoursPerWeek: true,
        joinedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ ok: true, employees });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}