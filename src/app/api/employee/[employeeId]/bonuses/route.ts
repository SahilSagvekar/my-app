export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bonus } from "@/lib/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

export async function GET(req: Request, context: { params: { employeeId: string } }) {
  try {
    const { params } = await Promise.resolve(context);
    const employeeId = Number(params.employeeId);
    const url = new URL(req.url);

    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const bonuses = await db.select().from(bonus).where(and(
      eq(bonus.employeeId, employeeId),
      gte(bonus.createdAt, monthStart.toISOString()),
      lte(bonus.createdAt, monthEnd.toISOString()),
    )).orderBy(desc(bonus.createdAt));

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
