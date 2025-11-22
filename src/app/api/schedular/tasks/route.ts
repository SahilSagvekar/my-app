import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma"; // adjust if you keep prisma at different path

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // Only scheduler / manager / admin should access
    if (!["scheduler", "manager", "admin"].includes((role || "").toLowerCase())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Fetch tasks that are ready for scheduler (QC set them ready)
    // Criteria: status = READY_FOR_SCHEDULER OR nextDestination = "scheduler"
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { status: "COMPLETED" },
          // { nextDestination: "scheduler" },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        // bring deliverable and files/drive info
        monthlyDeliverable: true, // MonthlyDeliverable relation
        // if files are in separate table, include them; otherwise driveLinks is on task
      },
    });

    // map to safe payload
    const payload = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate,
      clientId: t.clientId,
      driveLinks: t.driveLinks || [],
      createdAt: t.createdAt,
      monthlyDeliverable: t.monthlyDeliverable ? {
        id: t.monthlyDeliverable.id,
        type: t.monthlyDeliverable.type,
        quantity: t.monthlyDeliverable.quantity,
        postingSchedule: t.monthlyDeliverable.postingSchedule,
        postingDays: t.monthlyDeliverable.postingDays,
        postingTimes: t.monthlyDeliverable.postingTimes,
        platforms: t.monthlyDeliverable.platforms,
        description: t.monthlyDeliverable.description
      } : null,
    }));

    return NextResponse.json({ tasks: payload }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/scheduler/tasks error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
