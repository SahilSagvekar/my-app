export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { hostPayment, shootDetail } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";
import jwt from "jsonwebtoken";

function getUserFromToken(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return null;
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const hostId = Number(user.userId || user.id);
    if (!hostId || Number.isNaN(hostId)) {
      return NextResponse.json({ ok: false, message: "Invalid user" }, { status: 400 });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status"); // 'paid' | 'pending' | 'scheduled' | null (all)

    const payments = await db.query.hostPayment.findMany({
      where: eq(hostPayment.hostUserId, hostId),
      orderBy: (p, { desc }) => desc(p.createdAt),
    });

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const paidThisYear = payments.filter(
      (p) => p.status === "paid" && p.sentAt && new Date(p.sentAt) >= yearStart
    );
    const paidTotal = paidThisYear.reduce((sum, p) => sum + Number(p.amount), 0);

    const outstanding = payments.filter((p) => p.status !== "paid");
    const outstandingTotal = outstanding.reduce((sum, p) => sum + Number(p.amount), 0);
    const nextPayment = [...outstanding].sort((a, b) => {
      const ad = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
      const bd = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
      return ad - bd;
    })[0] || null;

    const shootsThisYear = await db
      .select({ id: shootDetail.id })
      .from(shootDetail)
      .where(and(eq(shootDetail.hostId, hostId), gte(shootDetail.shootDate, yearStart.toISOString())));
    const shootsWorked = shootsThisYear.length;

    const filtered = statusFilter
      ? payments.filter((p) => p.status === statusFilter)
      : payments;

    return NextResponse.json({
      ok: true,
      stats: {
        paidThisYear: paidTotal,
        paidCount: paidThisYear.length,
        outstandingTotal,
        nextPayment: nextPayment
          ? { label: nextPayment.label, date: nextPayment.scheduledDate }
          : null,
        shootsWorked,
      },
      payments: filtered,
    });
  } catch (err: any) {
    console.error("GET /api/host/payments error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}
