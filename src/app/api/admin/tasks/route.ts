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
// GET: Fetch all tasks with advanced filtering
// ─────────────────────────────────────────
export async function GET(req: Request) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const auth = verifyAdminAccess(token);
        if (!auth) {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);

        // Pagination
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "25");

        // Sorting
        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortOrder = searchParams.get("sortOrder") || "desc";

        // Filters
        const editorId = searchParams.get("editor");
        const qcId = searchParams.get("qc");
        const schedulerId = searchParams.get("scheduler");
        const videographerId = searchParams.get("videographer");
        const clientId = searchParams.get("client");
        const status = searchParams.get("status");
        const priority = searchParams.get("priority");
        const search = searchParams.get("search");
        const dueDateFrom = searchParams.get("dueDateFrom");
        const dueDateTo = searchParams.get("dueDateTo");
        const createdFrom = searchParams.get("createdFrom");
        const createdTo = searchParams.get("createdTo");

        // Build where clause with AND logic
        const where: any = {};

        if (editorId) where.assignedTo = parseInt(editorId);
        if (qcId) where.qc_specialist = parseInt(qcId);
        if (schedulerId) where.scheduler = parseInt(schedulerId);
        if (videographerId) where.videographer = parseInt(videographerId);
        if (clientId) where.clientId = clientId;
        if (status) where.status = status as TaskStatus;
        if (priority) where.priority = priority;

        // Text search on title and description
        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        // Date range filters
        if (dueDateFrom || dueDateTo) {
            where.dueDate = {};
            if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
            if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
        }

        if (createdFrom || createdTo) {
            where.createdAt = {};
            if (createdFrom) where.createdAt.gte = new Date(createdFrom);
            if (createdTo) where.createdAt.lte = new Date(createdTo);
        }

        // Build orderBy
        const orderBy: any = {};
        orderBy[sortBy] = sortOrder;

        // Fetch tasks with related data
        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where,
                take: limit,
                skip: (page - 1) * limit,
                orderBy,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    taskType: true,
                    status: true,
                    dueDate: true,
                    priority: true,
                    createdAt: true,
                    updatedAt: true,
                    workflowStep: true,
                    assignedTo: true,
                    qc_specialist: true,
                    scheduler: true,
                    videographer: true,
                    clientId: true,
                    feedback: true,
                    qcNotes: true,
                    // Include related user data
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                    client: {
                        select: {
                            id: true,
                            name: true,
                            companyName: true,
                        },
                    },
                    monthlyDeliverable: {
                        select: {
                            id: true,
                            type: true,
                        },
                    },
                },
            }),
            prisma.task.count({ where }),
        ]);

        // Fetch team member names for assigned users (QC, Scheduler, Videographer)
        const userIds = new Set<number>();
        tasks.forEach((task) => {
            if (task.qc_specialist) userIds.add(task.qc_specialist);
            if (task.scheduler) userIds.add(task.scheduler);
            if (task.videographer) userIds.add(task.videographer);
        });

        const teamMembers = await prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, name: true, role: true },
        });

        const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

        // Enrich tasks with team member names
        const enrichedTasks = tasks.map((task) => ({
            ...task,
            editor: task.user,
            qcSpecialist: task.qc_specialist ? memberMap.get(task.qc_specialist) : null,
            schedulerUser: task.scheduler ? memberMap.get(task.scheduler) : null,
            videographerUser: task.videographer ? memberMap.get(task.videographer) : null,
        }));

        // Calculate stats for quick summary
        const statusCounts = await prisma.task.groupBy({
            by: ["status"],
            where,
            _count: { status: true },
        });

        const overdueCount = await prisma.task.count({
            where: {
                ...where,
                dueDate: { lt: new Date() },
                status: { notIn: ["COMPLETED", "SCHEDULED"] },
            },
        });

        return NextResponse.json({
            tasks: enrichedTasks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            stats: {
                total,
                byStatus: statusCounts.reduce((acc, item) => {
                    acc[item.status] = item._count.status;
                    return acc;
                }, {} as Record<string, number>),
                overdue: overdueCount,
            },
        });
    } catch (err: any) {
        console.error("❌ GET /api/admin/tasks error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}
