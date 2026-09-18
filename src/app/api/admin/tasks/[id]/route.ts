export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { getDbHttp } from "@/lib/db";
import {
    task as taskTable,
    user as userTable,
    client as clientTable,
    taskStatus as taskStatusEnum,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { notifyEditorTaskAssignment } from '@/lib/notify';

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
        if (!["admin", "manager", "qc", "videographer"].includes(decoded.role?.toLowerCase())) {
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
  const db = getDbHttp();
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

        const rawTask = await db.query.task.findFirst({
            where: eq(taskTable.id, id),
            with: {
                user_assignedTo: {
                    columns: { id: true, name: true, email: true, role: true },
                },
                user_thumbnailEditor: {
                    columns: { id: true, name: true, email: true, role: true },
                },
                client: {
                    columns: { id: true, name: true, companyName: true },
                },
                monthlyDeliverable: true,
                files: {
                    columns: {
                        id: true,
                        name: true,
                        url: true,
                        mimeType: true,
                        size: true,
                        uploadedAt: true,
                    },
                    orderBy: (f, { desc }) => desc(f.uploadedAt),
                },
            },
        });

        if (!rawTask) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Rename Drizzle relation keys back to the Prisma field names this
        // handler was written against (qc_specialist raw FK, user relation).
        const { qcSpecialist, user_assignedTo, user_thumbnailEditor, ...restTask } = rawTask as any;
        const task = { ...restTask, qc_specialist: qcSpecialist, user: user_assignedTo, thumbnailEditorUser: user_thumbnailEditor };

        // Fetch team member details
        const userIds: number[] = [];
        if (task.qc_specialist) userIds.push(task.qc_specialist);
        if (task.scheduler) userIds.push(task.scheduler);
        if (task.videographer) userIds.push(task.videographer);

        const teamMembers = userIds.length > 0
            ? await db.select({ id: userTable.id, name: userTable.name, role: userTable.role })
                .from(userTable)
                .where(inArray(userTable.id, userIds))
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
  const db = getDbHttp();
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
        const [existingTask] = await db.select({ id: taskTable.id, title: taskTable.title, status: taskTable.status, assignedTo: taskTable.assignedTo, thumbnailEditor: taskTable.thumbnailEditor })
            .from(taskTable).where(eq(taskTable.id, id)).limit(1);

        if (!existingTask) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Extract updatable fields from body
        const {
            status,
            priority,
            dueDate,
            assignedTo,
            thumbnailEditor,
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
            updatedAt: new Date().toISOString(),
        };

        // Status update
        if (status !== undefined) {
            if (!(taskStatusEnum.enumValues as readonly string[]).includes(status)) {
                return NextResponse.json(
                    { message: `Invalid status: ${status}` },
                    { status: 400 }
                );
            }
            updateData.status = status;

            // Client Review Status & Reminder System — same stamp as the
            // main status route, since this admin edit path is a second
            // way a task can enter CLIENT_REVIEW (see the client-review
            // email-trigger fix earlier in this route).
            if (status === "CLIENT_REVIEW" && existingTask.status !== "CLIENT_REVIEW") {
                updateData.clientReviewStartedAt = new Date().toISOString();
            }
        }

        // Assignment updates - validate users exist
        if (assignedTo !== undefined) {
            if (assignedTo) {
                const [user] = await db.select().from(userTable).where(eq(userTable.id, assignedTo)).limit(1);
                if (!user) {
                    return NextResponse.json(
                        { message: `Editor not found (id: ${assignedTo})` },
                        { status: 404 }
                    );
                }
            }
            updateData.assignedTo = assignedTo;
        }

        if (thumbnailEditor !== undefined) {
            if (thumbnailEditor) {
                const [user] = await db.select().from(userTable).where(eq(userTable.id, thumbnailEditor)).limit(1);
                if (!user) {
                    return NextResponse.json(
                        { message: `Thumbnail editor not found (id: ${thumbnailEditor})` },
                        { status: 404 }
                    );
                }
            }
            updateData.thumbnailEditor = thumbnailEditor;
        }

        if (qc_specialist !== undefined) {
            if (qc_specialist) {
                const [user] = await db.select().from(userTable).where(eq(userTable.id, qc_specialist)).limit(1);
                if (!user) {
                    return NextResponse.json(
                        { message: `QC Specialist not found (id: ${qc_specialist})` },
                        { status: 404 }
                    );
                }
            }
            updateData.qcSpecialist = qc_specialist;
        }

        if (scheduler !== undefined) {
            if (scheduler) {
                const [user] = await db.select().from(userTable).where(eq(userTable.id, scheduler)).limit(1);
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
                const [user] = await db.select().from(userTable).where(eq(userTable.id, videographer)).limit(1);
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
        if (dueDate !== undefined) updateData.dueDate = new Date(dueDate).toISOString();
        if (feedback !== undefined) updateData.feedback = feedback;
        if (qcNotes !== undefined) updateData.qcNotes = qcNotes;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (workflowStep !== undefined) updateData.workflowStep = workflowStep;

        // Perform update
        const [updatedTaskRaw] = await db.update(taskTable).set(updateData).where(eq(taskTable.id, id)).returning();

        const [updatedUser] = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role })
            .from(userTable).where(eq(userTable.id, updatedTaskRaw.assignedTo)).limit(1);
        const [updatedThumbnailEditor] = updatedTaskRaw.thumbnailEditor
            ? await db.select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role })
                .from(userTable).where(eq(userTable.id, updatedTaskRaw.thumbnailEditor)).limit(1)
            : [null];
        const [updatedClient] = updatedTaskRaw.clientId
            ? await db.select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
                .from(clientTable).where(eq(clientTable.id, updatedTaskRaw.clientId)).limit(1)
            : [null];

        // Rename Drizzle's `qcSpecialist` schema property back to the raw
        // Prisma field name `qc_specialist`, and attach the `user`/`client`
        // relations the way Prisma's `include` used to.
        const { qcSpecialist, ...restUpdatedTask } = updatedTaskRaw as any;
        const updatedTask = {
            ...restUpdatedTask,
            qc_specialist: qcSpecialist,
            user: updatedUser ?? null,
            thumbnailEditorUser: updatedThumbnailEditor ?? null,
            client: updatedClient ?? null,
        };

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

        // 🔔 Notify the editor only if they were actually newly assigned
        // (not on unrelated edits to a task already assigned to them)
        if (
            assignedTo !== undefined &&
            assignedTo &&
            assignedTo !== existingTask.assignedTo
        ) {
            try {
                await notifyEditorTaskAssignment(assignedTo, [id]);
            } catch (err) {
                console.error("Failed to send assignment notification:", err);
            }
        }

        // 🔔 Same, for the separately-assigned thumbnail editor.
        if (
            thumbnailEditor !== undefined &&
            thumbnailEditor &&
            thumbnailEditor !== existingTask.thumbnailEditor
        ) {
            try {
                await notifyEditorTaskAssignment(thumbnailEditor, [id]);
            } catch (err) {
                console.error("Failed to send thumbnail editor assignment notification:", err);
            }
        }

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
  const db = getDbHttp();
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
        const [existingTask] = await db.select({ id: taskTable.id, title: taskTable.title })
            .from(taskTable).where(eq(taskTable.id, id)).limit(1);

        if (!existingTask) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }

        // Delete task (files will cascade delete due to relation)
        await db.delete(taskTable).where(eq(taskTable.id, id));

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