export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const m = cookieHeader.match(/authToken=([^;]+)/);
    return m ? m[1] : null;
}

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const { role, userId } = decoded;
        if (
            !["scheduler", "manager", "admin"].includes((role || "").toLowerCase())
        ) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = await context.params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: { client: true }
        });

        if (!task) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Determine what the "Pending" status should be. 
        // If client review was required, it might have been in CLIENT_REVIEW.
        // However, usually for scheduler, COMPLETED means ready to schedule.
        const newStatus = task.client?.requiresClientReview ? "CLIENT_REVIEW" : "COMPLETED";

        const updated = await prisma.task.update({
            where: { id },
            data: {
                status: newStatus,
                updatedAt: new Date(),
            },
        });

        // 📝 Audit log for un-scheduling
        await createAuditLog({
            userId: userId,
            action: AuditAction.TASK_STATUS_CHANGED,
            entity: "Task",
            entityId: id,
            details: `Task unscheduled by ${role}, moved back to ${newStatus}`,
            metadata: {
                taskId: id,
                taskTitle: task.title || task.description,
                previousStatus: task.status,
                newStatus: newStatus,
                role: role,
            },
        });

        return NextResponse.json({ task: updated }, { status: 200 });
    } catch (err: any) {
        console.error("PATCH /api/tasks/:id/mark-pending error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
