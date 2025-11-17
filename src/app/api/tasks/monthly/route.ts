export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    // Role-based filters
    const where =
      ["admin", "manager"].includes(decoded.role)
        ? {}
        : { assignedTo: Number(decoded.userId) };

    // Calculate ranges
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    const nextMonthStart = new Date(year, month + 1, 1);
    const nextMonthEnd = new Date(year, month + 2, 0, 23, 59, 59);

    // ========== CURRENT MONTH TASKS ==========
    const currentMonthTasks = await prisma.task.findMany({
      where: {
        ...where,
        dueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // ========== NEXT MONTH RECURRING ==========
    // const nextMonthRecurring = await prisma.recurringTask.findMany({
    //   where: {
    //     // client: where.clientId ? { id: where.clientId } : undefined,
    //     active: true,
    //     nextRunDate: {
    //       gte: nextMonthStart,
    //       lte: nextMonthEnd,
    //     },
    //   },
    //   include: {
    //     client: true,
    //     deliverable: true,
    //   },
    //   orderBy: { nextRunDate: "asc" },
    // });

    const nextMonthRecurring = await prisma.task.findMany({
      where: {
        ...where,
        dueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(
      {
        currentMonthTasks,
        nextMonthRecurring,
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("❌ GET /api/tasks/monthly error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
