// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["READY_FOR_QC", "ON_HOLD"],
  READY_FOR_QC: ["QC_IN_PROGRESS", "IN_PROGRESS"], // QC can send back to in_progress
  QC_IN_PROGRESS: ["COMPLETED", "REJECTED"],
  REJECTED: ["IN_PROGRESS"],
  ON_HOLD: ["IN_PROGRESS"],
  COMPLETED: [],
};

function normalizeStatus(s?: string | null) {
  return (s || "").toString().trim().toUpperCase();
}

function canTransition(current: string, next: string) {
  if (!current || !next) return false;
  if (current === next) return true;
  const allowed = VALID_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

function isEditorAllowed(userRole: string | undefined, current: string, next: string) {
  if (userRole === "manager" || userRole === "admin") return true;
  if (userRole === "editor") {
    // Editors may only do PENDING -> IN_PROGRESS and IN_PROGRESS -> READY_FOR_QC,
    // and IN_PROGRESS -> ON_HOLD (optional)
    if (current === "PENDING" && next === "IN_PROGRESS") return true;
    if (current === "IN_PROGRESS" && (next === "READY_FOR_QC" || next === "ON_HOLD")) return true;
  }
  if (userRole === "qc") {
    // QC team can move READY_FOR_QC -> QC_IN_PROGRESS -> COMPLETED or REJECTED
    if (current === "READY_FOR_QC" && next === "QC_IN_PROGRESS") return true;
    if (current === "QC_IN_PROGRESS" && (next === "COMPLETED" || next === "REJECTED")) return true;
  }
  return false;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const taskId = params.id;
    if (!taskId) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const requestedStatus = normalizeStatus(body.status);
    const files = body.files;

    if (!requestedStatus) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    // Fetch current task state
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const currentStatus = normalizeStatus(task.status);

    // Validate transition
    if (!canTransition(currentStatus, requestedStatus)) {
      return NextResponse.json({ error: `Invalid transition ${currentStatus} -> ${requestedStatus}` }, { status: 400 });
    }

    // RBAC
    if (!isEditorAllowed(user.role, currentStatus, requestedStatus)) {
      return NextResponse.json({ error: "Forbidden: role cannot perform this transition" }, { status: 403 });
    }

    // Update task (and optionally files)
    const dataToUpdate: any = { status: requestedStatus };
    if (Array.isArray(files)) dataToUpdate.files = files;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: dataToUpdate,
      select: {
        id: true,
        status: true,
        assignedTo: true,
        title: true,
        files: true,
        updatedAt: true
      }
    });

    // Write activity/audit log
    await prisma.activity.create({
      data: {
        taskId: taskId,
        userId: user.userId ?? null,
        action: "status_changed",
        payload: {
          from: currentStatus,
          to: requestedStatus,
          by: { id: user.userId, role: user.role, name: user.name ?? null }
        }
      }
    });

    // Optionally: publish an event to Redis/pusher here for realtime updates

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error("PATCH /api/tasks/[id] error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
