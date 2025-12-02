import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isEmployee } from "@/lib/auth";
import { countWorkingDaysBetween } from "@/lib/workdays";
import type { NextRequest } from "next/server";
import jwt from 'jsonwebtoken';
import { Console } from "console";

const LeaveSchema = z.object({
  startDate: z.string().datetime().or(z.string()), // we'll parse manually
  endDate: z.string().datetime().or(z.string()),
  reason: z.string().optional(),
});

// Helper function to get and verify token
function getUserFromToken(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    
    if (!token) {
      return null;
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded; // Handle different token structures
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}


export async function GET(
  req: NextRequest,
  context: { params: { employeeId: string } }
) {
  try {
    // Get and verify user from token
    const user = getUserFromToken(req);
    
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { params } = await Promise.resolve(context);
    const employeeId = Number(params.employeeId);

    if (!employeeId || Number.isNaN(employeeId)) {
      return NextResponse.json(
        { ok: false, message: "Invalid employee id" },
        { status: 400 }
      );
    }

    // admin OR that employee
    if (
      user.role !== "admin" &&
      !(isEmployee(user) && user.id === employeeId)
    ) {
      return NextResponse.json(
        { ok: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");

    let where: any = { employeeId };

    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      where.startDate = {
        gte: start,
        lte: end,
      };
    }

    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { startDate: "desc" },
      include: {
        deduction: true,
      },
    });

    return NextResponse.json({ ok: true, leaves });
  } catch (err: any) {
    console.error('GET /api/employee/[id]/leave error:', err);
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}