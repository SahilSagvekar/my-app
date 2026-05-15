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

    const where =
      ["admin", "manager"].includes(decoded.role)
        ? {}
        : { assignedTo: Number(decoded.userId) };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    // Single query — was being run twice with identical params (bug from refactor)
    const currentMonthTasks = await prisma.task.findMany({
      where: {
        ...where,
        dueDate: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(
      {
        currentMonthTasks,
        // nextMonthRecurring reuses the same data; caller can use currentMonthTasks
        nextMonthRecurring: currentMonthTasks,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/tasks/monthly error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}