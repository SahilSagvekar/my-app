import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import jwt from "jsonwebtoken";
import {
  notifyQCApproved,
  notifyQCRejected,
  notifyReadyForQC,
  notifyTaskStatusChanged,
  notifyClientReviewSubmitted,
} from "@/lib/notificationTriggers";

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

    // Get current task - REMOVED invalid includes
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!task)
      return NextResponse.json({ message: "Task not found" }, { status: 404 });

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });

    const currentUserName = currentUser?.name || currentUser?.email || 'Team member';

    // 🐛 DEBUG LOGGING
    console.log('📋 Task data:', {
      id: task.id,
      title: task.title,
      status: task.status,
      assignedTo: task.assignedTo,
      qc_specialist: task.qc_specialist,
      videographer: task.videographer,
      clientUserId: task.clientUserId,
    });
    console.log('👤 Current user:', { userId, role, name: currentUserName });
    console.log('🔄 Status change:', { from: task.status, to: status });

    // ✅ Define allowed transitions based on role
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

    console.log(role.toLowerCase(), status);

    if (
      role.toLowerCase() === "qc" &&
      status === "COMPLETED" &&
      task.client?.requiresClientReview === true
    ) {
      finalStatus = "CLIENT_REVIEW";
    }

    // Client approving or rejecting
    if (role.toLowerCase() === "client") {
      if (status === "COMPLETED") {
        finalStatus = "COMPLETED";
      } else if (status === "REJECTED") {
        finalStatus = "REJECTED";
      }
    }

    // ✅ Update task status
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...updateData,
        status: finalStatus,
        updatedAt: new Date(),
      },
    });

    // 🔔 SEND NOTIFICATIONS BASED ON STATUS CHANGES

    const taskTitle = task.title || `Task #${task.id}`;

    console.log('🔔 Preparing notifications...');

    // 1. Editor submits task for QC
    if (status === "READY_FOR_QC" && task.qc_specialist) {
      console.log('→ Notifying QC specialist:', task.qc_specialist);
      await notifyReadyForQC(
        task.qc_specialist,
        taskTitle,
        task.id,
        currentUserName
      );
    }

    // 2. QC approves task (going to CLIENT_REVIEW or COMPLETED)
    if (role.toLowerCase() === "qc" && status === "COMPLETED") {
      if (task.assignedTo) {
        console.log('→ Notifying editor (QC approved):', task.assignedTo);
        await notifyQCApproved(
          task.assignedTo,
          taskTitle,
          task.id,
          currentUserName
        );
      }

      // If going to client review, notify client
      if (finalStatus === "CLIENT_REVIEW" && task.clientUserId) {
        console.log('→ Notifying client:', task.clientUserId);
        await notifyClientReviewSubmitted(
          [task.clientUserId],
          task.client?.name || 'Client',
          taskTitle,
          task.id
        );
      }
    }

    // 3. QC rejects task
    if (role.toLowerCase() === "qc" && status === "REJECTED" && task.assignedTo) {
      console.log('→ Notifying editor (QC rejected):', task.assignedTo);
      await notifyQCRejected(
        task.assignedTo,
        taskTitle,
        task.id,
        currentUserName,
        qcNotes || feedback || "Please review and resubmit"
      );
    }

    // 4. Client approves content
    if (role.toLowerCase() === "client" && status === "COMPLETED") {
      // Notify editor
      if (task.assignedTo) {
        console.log('→ Notifying editor (client approved):', task.assignedTo);
        await notifyQCApproved(
          task.assignedTo,
          taskTitle,
          task.id,
          currentUserName
        );
      }
      
      // Notify manager/admin
      const managers = await prisma.user.findMany({
        where: { 
          role: { in: ['admin', 'manager'] }
        },
        select: { id: true }
      });
      
      if (managers.length > 0) {
        console.log('→ Notifying manager:', managers[0].id);
        await notifyTaskStatusChanged(
          managers[0].id,
          taskTitle,
          'Client Approved',
          task.id
        );
      }
    }

    // 5. Client rejects content
    if (role.toLowerCase() === "client" && status === "REJECTED" && task.assignedTo) {
      console.log('→ Notifying editor (client rejected):', task.assignedTo);
      await notifyQCRejected(
        task.assignedTo,
        taskTitle,
        task.id,
        currentUserName,
        feedback || "Client requested changes"
      );
    }

    // 6. General status changes for other transitions
    if (["IN_PROGRESS", "ON_HOLD"].includes(status) && task.assignedTo && task.assignedTo !== userId) {
      console.log('→ Notifying assignee (status change):', task.assignedTo);
      await notifyTaskStatusChanged(
        task.assignedTo,
        taskTitle,
        finalStatus,
        task.id
      );
    }

    console.log('✅ Notifications complete');

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err: any) {
    console.error("❌ Task status update error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}