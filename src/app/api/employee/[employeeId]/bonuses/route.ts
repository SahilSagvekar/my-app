import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, context: { params: { employeeId: string } }) {
  try {
    const { params } = await Promise.resolve(context);
    const employeeId = Number(params.employeeId);
    const url = new URL(req.url);

    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const bonuses = await prisma.bonus.findMany({
      where: {
        employeeId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

    return NextResponse.json({ ok: true, bonuses, total });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status: 400 }
    );
  }
}
