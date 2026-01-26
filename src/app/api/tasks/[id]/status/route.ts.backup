import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
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
    const body = await req.json();
    const { status, feedback, qcNotes, route, shareToken } = body;

    let userId: any;
    let role: string | undefined;

    // 1. Check for standard auth cookie first
    const authToken = getTokenFromCookies(req);
    if (authToken) {
      try {
        const decoded: any = jwt.verify(authToken, process.env.JWT_SECRET!);
        userId = decoded.userId;
        role = decoded.role;
      } catch (err) {
        console.error("JWT verify failed, checking share token...");
      }
    }

    // 2. If no user, check for shareToken
    if (!userId && shareToken) {
      const shareableReview = await (prisma as any).shareableReview.findUnique({
        where: { shareToken },
      });

      if (shareableReview && shareableReview.isActive && (!shareableReview.expiresAt || shareableReview.expiresAt > new Date())) {
        if (shareableReview.taskId !== id) {
          return NextResponse.json({ message: "Invalid share token for this task" }, { status: 403 });
        }
        // Valid share token! Treat as a "client" role
        userId = shareableReview.createdBy; // Use the creator's ID for accountability
        role = "client";
      }
    }

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    // const allowedTransitions: Record<string, string[]> = {
    //   editor: ["IN_PROGRESS", "READY_FOR_QC", "ON_HOLD"],
    //   qc: ["QC_IN_PROGRESS", "COMPLETED", "REJECTED"],
    //   client: ["CLIENT_REVIEW", "COMPLETED", "REJECTED"],
    //   scheduler: [],
    //   manager: [
    //     "PENDING",
    //     "IN_PROGRESS",
    //     "READY_FOR_QC",
    //     "QC_IN_PROGRESS",
    //     "COMPLETED",
    //     "ON_HOLD",
    //     "REJECTED",
    //   ],
    //   admin: [
    //     "PENDING",
    //     "IN_PROGRESS",
    //     "READY_FOR_QC",
    //     "QC_IN_PROGRESS",
    //     "COMPLETED",
    //     "ON_HOLD",
    //     "REJECTED",
    //   ],
    // };

    // const allowed = allowedTransitions[role.toLowerCase()] || [];

    // if (!allowed.includes(status)) {
    //   return NextResponse.json(
    //     { message: `Role '${role}' cannot set status to '${status}'` },
    //     { status: 403 }
    //   );
    // }

    if (
      role?.toLowerCase() === "qc" &&
      status === "COMPLETED" &&
      task.client?.requiresClientReview === true
    ) {
      finalStatus = "CLIENT_REVIEW";
    }

    if (role?.toLowerCase() === "client") {
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

    // 3. Create audit log ONLY if we have a real user (not a guest)
    const currentToken = getTokenFromCookies(req);
    if (currentToken && role && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      await createAuditLog({
        userId: userId,
        action: AuditAction.USER_UPDATED,
        entity: "User",
        entityId: userId.toString(),
        details: `Updated task status via review: ${user?.name} (${user?.email})`,
        metadata: {
          employeeId: userId,
          role: role,
          email: user?.email,
        },
      });
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err: any) {
    console.error("❌ Task status update error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}