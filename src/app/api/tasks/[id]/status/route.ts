import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { redis } from '@/lib/redis';
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
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    const body = await req.json();
    const { status, feedback, qcNotes, route } = body;

    let finalStatus = status;

    if (!status)
      return NextResponse.json({ message: "Status is required" }, { status: 400 });

    const updateData: any = {};

    if (feedback !== undefined) updateData.feedback = feedback;
    if (qcNotes !== undefined) updateData.qcNotes = qcNotes;
    if (route !== undefined) updateData.route = route;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!task)
      return NextResponse.json({ message: "Task not found" }, { status: 404 });

    const allowedTransitions: Record<string, string[]> = {
      editor: ["IN_PROGRESS", "READY_FOR_QC", "ON_HOLD"],
      qc: ["QC_IN_PROGRESS", "COMPLETED", "REJECTED"],
      client: ["CLIENT_REVIEW", "COMPLETED", "REJECTED"],
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

    if (
      role.toLowerCase() === "qc" &&
      status === "COMPLETED" &&
      task.client?.requiresClientReview === true
    ) {
      finalStatus = "CLIENT_REVIEW";
    }

    if (role.toLowerCase() === "client") {
      if (status === "COMPLETED") {
        finalStatus = "COMPLETED";
      } else if (status === "REJECTED") {
        finalStatus = "REJECTED";
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...updateData,
        status: finalStatus,
        updatedAt: new Date(),
      },
    });

    const usersToInvalidate = [
      userId,
      task.assignedTo,
      task.qc_specialist,
      task.scheduler,
      task.clientUserId,
      task.createdBy
    ].filter(Boolean);

    for (const uid of usersToInvalidate) {
      const keys = await redis.keys(`tasks:${uid}:*`);
      if (keys.length > 0) await redis.del(...keys);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    await createAuditLog({
      userId: userId,
      action: AuditAction.USER_UPDATED,
      entity: "User",
      entityId: userId.toString(),
      details: `Updated employee: ${user?.name} (${user?.email})`,
      metadata: {
        employeeId: userId,
        role: role,
        email: user?.email,
      },
    });

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err: any) {
    console.error("❌ Task status update error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}