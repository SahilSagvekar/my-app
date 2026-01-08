export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";
import { createAuditLog, AuditAction } from '@/lib/audit-logger';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function verifyAdminAccess(token: string): { userId: number; role: string } | null {
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!["admin", "manager"].includes(decoded.role?.toLowerCase())) {
            return null;
        }
        return { userId: decoded.userId, role: decoded.role };
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────
// GET: Fetch single task with full details
// ─────────────────────────────────────────
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const auth = verifyAdminAccess(token);
        if (!auth) {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { id } = await params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
                client: {
                    select: { id: true, name: true, companyName: true },
                },
                monthlyDeliverable: true,
                files: {
                    select: {
                        id: true,
                        name: true,
                        url: true,
                        mimeType: true,
                        size: true,
                        uploadedAt: true,
                    },
                    orderBy: { uploadedAt: "desc" },
                },
            },
        });

        if (!task) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Fetch team member details
        const userIds: number[] = [];
        if (task.qc_specialist) userIds.push(task.qc_specialist);
        if (task.scheduler) userIds.push(task.scheduler);
        if (task.videographer) userIds.push(task.videographer);

        const teamMembers = userIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, role: true },
            })
            : [];

        const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

        return NextResponse.json({
            ...task,
            editor: task.user,
            qcSpecialist: task.qc_specialist ? memberMap.get(task.qc_specialist) : null,
            schedulerUser: task.scheduler ? memberMap.get(task.scheduler) : null,
            videographerUser: task.videographer ? memberMap.get(task.videographer) : null,
        });
    } catch (err: any) {
        console.error("❌ GET /api/admin/tasks/[id] error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────
// PATCH: Update task (status, assignments, etc.)
// ─────────────────────────────────────────
export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const auth = verifyAdminAccess(token);
        if (!auth) {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();

        // Validate task exists
        const existingTask = await prisma.task.findUnique({
            where: { id },
            select: { id: true, title: true, status: true },
        });

        if (!existingTask) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Extract updatable fields from body
        const {
            status,
            priority,
            dueDate,
            assignedTo,
            qc_specialist,
            scheduler,
            videographer,
            feedback,
            qcNotes,
            title,
            description,
            workflowStep,
        } = body;

        // Build update data
        const updateData: any = {
            updatedAt: new Date(),
        };

        // Status update
        if (status !== undefined) {
            if (!Object.values(TaskStatus).includes(status)) {
                return NextResponse.json(
                    { message: `Invalid status: ${status}` },
                    { status: 400 }
                );
            }
            updateData.status = status;
        }

        // Assignment updates - validate users exist
        if (assignedTo !== undefined) {
            if (assignedTo) {
                const user = await prisma.user.findUnique({ where: { id: assignedTo } });
                if (!user) {
                    return NextResponse.json(
                        { message: `Editor not found (id: ${assignedTo})` },
                        { status: 404 }
                    );
                }
            }
            updateData.assignedTo = assignedTo;
        }

        if (qc_specialist !== undefined) {
            if (qc_specialist) {
                const user = await prisma.user.findUnique({ where: { id: qc_specialist } });
                if (!user) {
                    return NextResponse.json(
                        { message: `QC Specialist not found (id: ${qc_specialist})` },
                        { status: 404 }
                    );
                }
            }
            updateData.qc_specialist = qc_specialist;
        }

        if (scheduler !== undefined) {
            if (scheduler) {
                const user = await prisma.user.findUnique({ where: { id: scheduler } });
                if (!user) {
                    return NextResponse.json(
                        { message: `Scheduler not found (id: ${scheduler})` },
                        { status: 404 }
                    );
                }
            }
            updateData.scheduler = scheduler;
        }

        if (videographer !== undefined) {
            if (videographer) {
                const user = await prisma.user.findUnique({ where: { id: videographer } });
                if (!user) {
                    return NextResponse.json(
                        { message: `Videographer not found (id: ${videographer})` },
                        { status: 404 }
                    );
                }
            }
            updateData.videographer = videographer;
        }

        // Other field updates
        if (priority !== undefined) updateData.priority = priority;
        if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
        if (feedback !== undefined) updateData.feedback = feedback;
        if (qcNotes !== undefined) updateData.qcNotes = qcNotes;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (workflowStep !== undefined) updateData.workflowStep = workflowStep;

        // Perform update
        const updatedTask = await prisma.task.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
                client: {
                    select: { id: true, name: true, companyName: true },
                },
            },
        });

        // Create audit log
        await createAuditLog({
            userId: auth.userId,
            action: AuditAction.TASK_UPDATED,
            entity: "Task",
            entityId: id,
            details: `Admin updated task: ${existingTask.title || id}`,
            metadata: {
                taskId: id,
                changes: Object.keys(updateData).filter((k) => k !== "updatedAt"),
                previousStatus: existingTask.status,
                newStatus: updateData.status,
            },
        });

        return NextResponse.json(updatedTask);
    } catch (err: any) {
        console.error("❌ PATCH /api/admin/tasks/[id] error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────
// DELETE: Delete a task (admin only)
// ─────────────────────────────────────────
export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const auth = verifyAdminAccess(token);
        if (!auth) {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { id } = await params;

        // Validate task exists
        const existingTask = await prisma.task.findUnique({
            where: { id },
            select: { id: true, title: true },
        });

        if (!existingTask) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Delete task (files will cascade delete due to relation)
        await prisma.task.delete({
            where: { id },
        });

        // Create audit log
        await createAuditLog({
            userId: auth.userId,
            action: AuditAction.TASK_DELETED,
            entity: "Task",
            entityId: id,
            details: `Admin deleted task: ${existingTask.title || id}`,
            metadata: { taskId: id },
        });

        return NextResponse.json({ message: "Task deleted successfully" });
    } catch (err: any) {
        console.error("❌ DELETE /api/admin/tasks/[id] error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}
