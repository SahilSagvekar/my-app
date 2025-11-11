import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    const body = await req.json();
    const { status } = body;

    if (!status)
      return NextResponse.json({ message: "Status is required" }, { status: 400 });

    // Get current task
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task)
      return NextResponse.json({ message: "Task not found" }, { status: 404 });

    // ✅ Define allowed transitions based on role
    const allowedTransitions: Record<string, string[]> = {
      editor: ["IN_PROGRESS", "READY_FOR_QC", "ON_HOLD"],
      qc: ["QC_IN_PROGRESS", "COMPLETED", "REJECTED"],
      scheduler: [],
      manager: [
        "PENDING",
        "IN_PROGRESS",
        "READY_FOR_QC",
        "QC_IN_PROGRESS",
        "COMPLETED",
        "ON_HOLD",
        "REJECTED",
      ],
      admin: [
        "PENDING",
        "IN_PROGRESS",
        "READY_FOR_QC",
        "QC_IN_PROGRESS",
        "COMPLETED",
        "ON_HOLD",
        "REJECTED",
      ],
    };

    const allowed = allowedTransitions[role.toLowerCase()] || [];

    if (!allowed.includes(status)) {
      return NextResponse.json(
        { message: `Role '${role}' cannot set status to '${status}'` },
        { status: 403 }
      );
    }

    // ✅ Update task status
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err: any) {
    console.error("❌ Task status update error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}